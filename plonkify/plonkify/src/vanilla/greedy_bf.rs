use std::{
    cmp::Ordering,
    collections::{BTreeSet, HashMap},
};

use crate::{
    circuit::{PlonkishCircuit, PlonkishCircuitParams},
    custom_gate::CustomizedGates,
    plonkify::Plonkifier,
    selectors::SelectorColumn,
};
use ark_ff::{batch_inversion, PrimeField};
use circom_compat::R1CSFile;
use rayon::prelude::*;

#[derive(PartialEq, Eq, Clone)]
struct RelationRecord<F: PrimeField>(usize, (usize, usize, F));

impl<F: PrimeField> Ord for RelationRecord<F> {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0
            .cmp(&other.0)
            .then(self.1 .0.cmp(&other.1 .0))
            .then(self.1 .1.cmp(&other.1 .1))
            .then(self.1 .2.into_bigint().cmp(&other.1 .2.into_bigint()))
            .reverse()
    }
}
impl<F: PrimeField> PartialOrd for RelationRecord<F> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct GreedyBruteForcePlonkifier<F: PrimeField> {
    constraint_selectors: Vec<SelectorColumn<F>>,
    constraint_variables: Vec<Vec<usize>>,
    variable_assignments: Vec<F>,
}

impl<F: PrimeField> GreedyBruteForcePlonkifier<F> {
    fn add_selectors(&mut self, values: Vec<F>) {
        for (i, selector) in values.iter().enumerate() {
            self.constraint_selectors[i].0.push(*selector);
        }
    }

    fn addition(&mut self, var_a: usize, var_b: usize, coeff: F) -> usize {
        self.add_selectors(vec![F::one(), coeff, -F::one(), F::zero(), F::zero()]);

        let new_index = self.variable_assignments.len();
        self.variable_assignments
            .push(self.variable_assignments[var_a] + self.variable_assignments[var_b] * coeff);

        self.constraint_variables
            .push(vec![var_a, var_b, new_index]);
        new_index
    }

    fn mul_constraint(
        &mut self,
        (var_a, coeff_a, const_a): (usize, F, F),
        (var_b, coeff_b, const_b): (usize, F, F),
        (var_c, coeff_c, const_c): (usize, F, F),
    ) {
        self.add_selectors(vec![
            const_b * coeff_a,
            const_a * coeff_b,
            -coeff_c,
            coeff_a * coeff_b,
            const_a * const_b - const_c,
        ]);
        self.constraint_variables.push(vec![var_a, var_b, var_c]);
    }

    fn mul_constraint_c_opt(
        &mut self,
        (var_a, coeff_a, const_a): (usize, F, F),
        (var_b, coeff_b, const_b): (usize, F, F),
        variables_c: &[(usize, F)],
        const_c: F,
    ) {
        let mut selectors = vec![
            const_b * coeff_a,
            const_a * coeff_b,
            F::zero(),
            coeff_a * coeff_b,
            const_a * const_b - const_c,
        ];
        let mut var_c = 0usize;
        for (var, coeff) in variables_c {
            if *var == var_a {
                selectors[0] -= coeff;
            } else if *var == var_b {
                selectors[1] -= coeff;
            } else {
                var_c = *var;
                selectors[2] -= coeff;
            }
        }
        self.add_selectors(selectors);
        self.constraint_variables.push(vec![var_a, var_b, var_c]);
    }

    fn lc_sum(&mut self, (variables, constant): &(Vec<(usize, F)>, F)) -> (usize, F, F) {
        if variables.len() == 0 {
            (0, F::zero(), *constant)
        } else if variables.len() == 1 {
            (variables[0].0, variables[0].1, *constant)
        } else {
            let mut sum = (variables[0].0, variables[0].1);
            let inverse = sum.1.inverse().unwrap();
            for (var, coeff) in variables.iter().skip(1) {
                let new_var = self.addition(sum.0, *var, *coeff * inverse);
                sum = (new_var, sum.1);
            }
            (sum.0, sum.1, *constant)
        }
    }

    fn lc_sum_c_opt(
        &mut self,
        variables: &[(usize, F)],
        var_a: usize,
        var_b: usize,
    ) -> Vec<(usize, F)> {
        if variables.len() == 0 {
            return vec![];
        }

        let mut terms = variables
            .iter()
            .filter(|(idx, coeff)| {
                (*idx == 0 || *idx == var_a || *idx == var_b) && !coeff.is_zero()
            })
            .map(|x| *x)
            .collect::<Vec<_>>();
        let mut sum = (0, F::zero());
        let mut inverse = F::zero();
        for (var, coeff) in variables {
            if *var == 0 || *var == var_a || *var == var_b || coeff.is_zero() {
                continue;
            }
            if sum.0 == 0 {
                sum = (*var, *coeff);
                inverse = sum.1.inverse().unwrap();
            } else {
                let new_var = self.addition(sum.0, *var, *coeff * inverse);
                sum.0 = new_var;
            }
        }
        terms.push((sum.0, sum.1));
        terms
    }
}

impl<F: PrimeField> Plonkifier<F> for GreedyBruteForcePlonkifier<F> {
    fn plonkify(r1cs: &R1CSFile<F>) -> (PlonkishCircuit<F>, Vec<F>) {
        let gate = CustomizedGates::vanilla_plonk_gate();
        let mut data = Self {
            constraint_selectors: vec![SelectorColumn::<F>(vec![]); gate.num_selector_columns()],
            constraint_variables: Vec::new(),
            variable_assignments: r1cs.witness.clone(),
        };
        let mut relation_queue: BTreeSet<RelationRecord<F>> = BTreeSet::new();
        let mut constraints: Vec<[(Vec<(usize, F)>, F); 3]> = r1cs
            .constraints
            .par_iter()
            .map(|(a, b, c)| {
                let process_lc = |variables: &Vec<(usize, F)>| -> (Vec<(usize, F)>, F) {
                    let constant = variables
                        .iter()
                        .filter(|(idx, _)| *idx == 0)
                        .fold(F::zero(), |acc, (_, coeff)| acc + coeff);
                    let mut variables = variables
                        .iter()
                        .filter(|(idx, coeff)| *idx != 0 && !coeff.is_zero())
                        .map(|x| *x)
                        .collect::<Vec<_>>();
                    variables.sort_by_key(|(idx, _)| *idx);
                    (variables, constant)
                };
                [process_lc(a), process_lc(b), process_lc(c)]
            })
            .collect();
        let mut constraint_inverses: Vec<[Vec<F>; 3]> =
            vec![[vec![], vec![], vec![]]; r1cs.constraints.len()];

        // Create constraints for public inputs
        let num_public_inputs = r1cs.header.n_pub_in + r1cs.header.n_pub_out;
        for i in 0..num_public_inputs {
            data.add_selectors(vec![F::zero(), F::zero(), F::zero(), F::zero(), F::zero()]);
            data.constraint_variables.push(vec![i as usize, 0, 0]);
        }

        println!("Preparing initial relations");

        let chunk_size = constraints.len() / rayon::current_num_threads() / 8;
        let mut relation_occurrences = constraints
            .par_chunks_mut(chunk_size)
            .zip(constraint_inverses.par_chunks_mut(chunk_size))
            .enumerate()
            .map(|(chunk_idx, (constraints, inverses))| {
                let mut out = HashMap::new();
                for (idx, lcs) in constraints.iter_mut().enumerate() {
                    let constraint_idx = chunk_idx * chunk_size + idx;
                    for (lc_idx, (lc, _)) in lcs.iter_mut().enumerate() {
                        let inverses = &mut inverses[idx][lc_idx];
                        *inverses = lc.iter().map(|(_, coeff)| *coeff).collect::<Vec<_>>();
                        batch_inversion(inverses);

                        for i in 1..lc.len() {
                            debug_assert_ne!(lc[i].0, lc[i - 1].0);
                        }
                        let len = lc.len();
                        for i in 0..len {
                            for j in (i + 1)..len {
                                out.entry((lc[i].0, lc[j].0, lc[j].1 * inverses[i]))
                                    .or_insert_with(|| Vec::new())
                                    .push((constraint_idx, lc_idx));
                            }
                        }
                    }
                }
                out
            })
            .reduce(
                || HashMap::new(),
                |mut a, b| {
                    for (relation, mut occurrences) in b {
                        a.entry(relation)
                            .and_modify(|v| v.append(&mut occurrences))
                            .or_insert_with(move || occurrences);
                    }
                    a
                },
            );

        // No new relations can ever be added for old varaibles so those terms are never necessary
        relation_occurrences.retain(|_, occurrences| occurrences.len() > 1);
        relation_occurrences.shrink_to_fit();
        for (relation, occurrences) in &relation_occurrences {
            relation_queue.insert(RelationRecord(occurrences.len(), *relation));
        }

        println!("Initial relations complete");

        let mut count_constraints = 0;
        while !relation_queue.is_empty() {
            let record = (*relation_queue.first().unwrap()).clone();
            let RelationRecord(count, (var_a, var_b, coeff)) = record;
            relation_queue.remove(&record);
            debug_assert!(count > 1);

            let new_var = data.addition(var_a, var_b, coeff);
            count_constraints += 1;
            if count_constraints % 1000 == 0 {
                println!(
                    "Written {} constraints, {} remaining",
                    count_constraints,
                    relation_queue.len()
                );
            }

            let mut updated_relations = HashMap::new();
            for (constraint_idx, lc_idx) in
                relation_occurrences.remove(&(var_a, var_b, coeff)).unwrap()
            {
                let (lc, _) = &mut constraints[constraint_idx][lc_idx];
                let inverses = &mut constraint_inverses[constraint_idx][lc_idx];

                let idx_a = lc.binary_search(&(var_a, F::zero())).unwrap_err();
                debug_assert_eq!(lc[idx_a].0, var_a);
                let idx_b = lc.binary_search(&(var_b, F::zero())).unwrap_err();
                debug_assert_eq!(lc[idx_b].0, var_b);
                let (coeff_a, inverse_a, coeff_b, inverse_b) =
                    (lc[idx_a].1, inverses[idx_a], lc[idx_b].1, inverses[idx_b]);

                for i in std::cmp::min(idx_a, idx_b)..(lc.len() - 2) {
                    if i < std::cmp::max(idx_a, idx_b) - 1 {
                        lc[i] = lc[i + 1];
                        inverses[i] = inverses[i + 1];
                    } else {
                        lc[i] = lc[i + 2];
                        inverses[i] = inverses[i + 2];
                    }
                }
                lc.truncate(lc.len() - 2);
                inverses.truncate(inverses.len() - 2);

                let remove_occurrence =
                    |occurrences_map: &mut HashMap<(usize, usize, F), Vec<(usize, usize)>>,
                     updated_relations: &mut HashMap<(usize, usize, F), (usize, usize)>,
                     var_a,
                     coeff_a,
                     inverse_a,
                     var_b,
                     coeff_b,
                     inverse_b| {
                        let relation = if var_a < var_b {
                            (var_a, var_b, coeff_b * inverse_a)
                        } else {
                            (var_b, var_a, coeff_a * inverse_b)
                        };
                        occurrences_map.get_mut(&relation).map(|occurrences| {
                            let original_len = occurrences.len();
                            occurrences.remove(
                                occurrences
                                    .binary_search(&(constraint_idx, lc_idx))
                                    .unwrap(),
                            );
                            // This is really just a fancy way to write try_insert because
                            // it's still nightly for some reason
                            updated_relations
                                .entry(relation)
                                .or_insert((original_len, 0))
                                .1 = occurrences.len();
                        });
                    };

                for ((var, coeff), inverse) in lc.iter().zip(inverses.iter()) {
                    remove_occurrence(
                        &mut relation_occurrences,
                        &mut updated_relations,
                        *var,
                        *coeff,
                        *inverse,
                        var_a,
                        coeff_a,
                        inverse_a,
                    );
                    remove_occurrence(
                        &mut relation_occurrences,
                        &mut updated_relations,
                        *var,
                        *coeff,
                        *inverse,
                        var_b,
                        coeff_b,
                        inverse_b,
                    );

                    // Add occurrence with new var
                    let relation = (*var, new_var, coeff_a * *inverse);
                    let occurrences = relation_occurrences
                        .entry(relation)
                        .or_insert_with(|| Vec::new());
                    occurrences.push((constraint_idx, lc_idx));
                    updated_relations.entry(relation).or_insert((0, 0)).1 = occurrences.len();
                }

                lc.push((new_var, coeff_a));
                inverses.push(inverse_a);
            }

            for (relation, (old_count, new_count)) in updated_relations {
                if old_count > 1 {
                    relation_queue.remove(&RelationRecord(old_count, relation));
                }
                if new_count > 1 {
                    relation_queue.insert(RelationRecord(new_count, relation));
                }
            }
        }

        println!("Finishing loose sums");

        for [a, b, c] in &constraints {
            let value_a = data.lc_sum(&a);
            let value_b = data.lc_sum(&b);

            let value_c = data.lc_sum_c_opt(&c.0, value_a.0, value_b.0);
            data.mul_constraint_c_opt(value_a, value_b, &value_c, c.1);
        }

        let num_constraints = data.constraint_variables.len();
        let mut variable_uses = vec![vec![]; data.variable_assignments.len()];
        for (constraint_idx, variables) in data.constraint_variables.iter().enumerate() {
            for (col, variable) in variables.iter().enumerate() {
                variable_uses[*variable].push(col * num_constraints + constraint_idx);
            }
        }

        // Start from identity permutation
        let mut permutation = vec![F::zero(); gate.num_witness_columns() * num_constraints];
        for i in 1..permutation.len() {
            permutation[i] = permutation[i - 1] + F::one();
        }
        for uses in variable_uses {
            for i in 0..uses.len() {
                let next = if i == uses.len() - 1 { 0 } else { i + 1 };
                permutation[uses[i]] = F::from_u64(uses[next] as u64).unwrap();
            }
        }

        let mut witness = vec![F::zero(); gate.num_witness_columns() * num_constraints];
        for (constraint_idx, variables) in data.constraint_variables.iter().enumerate() {
            for (col, variable_idx) in variables.iter().enumerate() {
                witness[col * num_constraints + constraint_idx] =
                    data.variable_assignments[*variable_idx];
            }
        }

        (
            PlonkishCircuit {
                permutation,
                selectors: data.constraint_selectors,
                params: PlonkishCircuitParams {
                    num_constraints,
                    num_pub_input: num_public_inputs as usize,
                    gate_func: gate,
                },
            },
            witness,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bn254::Fr;
    use ark_std::io::{BufReader, Cursor};
    use circom_compat::read_witness;
    use std::fs::File;

    #[test]
    fn test_sample() {
        let data = hex_literal::hex!(
            "72 31 63 73 01 00 00 00 03 00 00 00 01 00 00 00 40 00 00 00 00 00 00 00 20 00 00 00 01 00 00 F0 93 F5 E1 43 91 70 B9 79 48 E8 33 28 5D 58 81 81 B6 45 50 B8 29 A0 31 E1 72 4E 64 30 04 00 00 00 01 00 00 00 00 00 00 00 02 00 00 00 04 00 00 00 00 00 00 00 01 00 00 00 02 00 00 00 78 00 00 00 00 00 00 00 01 00 00 00 02 00 00 00 00 00 00 F0 93 F5 E1 43 91 70 B9 79 48 E8 33 28 5D 58 81 81 B6 45 50 B8 29 A0 31 E1 72 4E 64 30 01 00 00 00 03 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 01 00 00 00 00 00 00 F0 93 F5 E1 43 91 70 B9 79 48 E8 33 28 5D 58 81 81 B6 45 50 B8 29 A0 31 E1 72 4E 64 30 03 00 00 00 20 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 02 00 00 00 00 00 00 00"
        );

        let witness_file = r#"[
 "1"
,"33"
,"3"
,"11"
]"#;
        let reader = BufReader::new(Cursor::new(&data[..]));
        let mut file = R1CSFile::<Fr>::new(reader).unwrap();

        let witness_reader = BufReader::new(Cursor::new(&witness_file[..]));
        file.witness = read_witness::<Fr>(witness_reader);

        let (plonkish_circuit, plonkish_witness) =
            GreedyBruteForcePlonkifier::<Fr>::plonkify(&file);
        assert!(plonkish_circuit.is_satisfied(&plonkish_witness));
    }

    #[test]
    fn test_sample_2() {
        let reader = BufReader::new(File::open("D:/Projects/circuit.r1cs").unwrap());
        let mut file = R1CSFile::<Fr>::new(reader).unwrap();
        println!("R1CS num constraints: {}", file.header.n_constraints);

        let witness_reader = BufReader::new(File::open("D:/Projects/witness.json").unwrap());
        file.witness = read_witness::<Fr>(witness_reader);

        let (plonkish_circuit, plonkish_witness) =
            GreedyBruteForcePlonkifier::<Fr>::plonkify(&file);
        println!(
            "Plonk num constraints: {}",
            plonkish_circuit.params.num_constraints
        );
        assert!(plonkish_circuit.is_satisfied(&plonkish_witness));
    }
}

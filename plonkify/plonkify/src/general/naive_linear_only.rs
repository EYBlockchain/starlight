use std::collections::HashMap;

use crate::{
    circuit::{PlonkishCircuit, PlonkishCircuitParams},
    custom_gate::GateInfo,
    selectors::SelectorColumn,
    CustomizedGates, GeneralPlonkifer,
};
use ark_ff::PrimeField;
use circom_compat::R1CSFile;

pub struct NaiveLinearOnlyGeneralPlonkifier<F: PrimeField> {
    gate: GateInfo,
    constraint_selectors: Vec<SelectorColumn<F>>,
    constraint_variables: Vec<Vec<usize>>,
    variable_assignments: Vec<F>,
}

impl<F: PrimeField> NaiveLinearOnlyGeneralPlonkifier<F> {
    fn add_selectors(&mut self, values: Vec<F>) {
        for (i, selector) in values.iter().enumerate() {
            self.constraint_selectors[i].0.push(*selector);
        }
    }

    fn addition(&mut self, vars: &[(usize, F)]) -> (usize, F) {
        assert!(vars.len() <= self.gate.linear_terms.len());

        let selector_len = self.gate.num_selector_columns();
        let mut selectors = vec![F::zero(); selector_len];
        let mut variables = vec![0; self.gate.num_witness_columns()];

        for ((var, coeff), (var_idx, selector_idx)) in
            vars.iter().zip(self.gate.linear_terms.iter())
        {
            selectors[*selector_idx] = *coeff;
            variables[*var_idx] = *var;
        }
        selectors[selector_len - 2] = -F::one();
        let new_index = self.variable_assignments.len();
        *variables.last_mut().unwrap() = new_index;

        let sum = vars
            .iter()
            .map(|(var, coeff)| *coeff * self.variable_assignments[*var])
            .sum::<F>();
        self.variable_assignments.push(sum);

        self.add_selectors(selectors);
        self.constraint_variables.push(variables);
        (new_index, F::one())
    }

    fn mul_constraint(
        &mut self,
        (var_a, coeff_a, const_a): (usize, F, F),
        (var_b, coeff_b, const_b): (usize, F, F),
        (var_c, coeff_c, const_c): (usize, F, F),
    ) {
        let (var_idx_a, var_idx_b, selector_a, selector_b, selector_mul) =
            self.gate.vanilla_compatibility_info;

        let selector_len = self.gate.num_selector_columns();
        let mut selectors = vec![F::zero(); selector_len];
        selectors[selector_a] = const_b * coeff_a;
        selectors[selector_b] = const_a * coeff_b;
        selectors[selector_len - 2] = -coeff_c;
        selectors[selector_mul] = coeff_a * coeff_b;
        *selectors.last_mut().unwrap() = const_a * const_b - const_c;

        let mut variables = vec![0; self.gate.num_witness_columns()];
        variables[var_idx_a] = var_a;
        variables[var_idx_b] = var_b;
        *variables.last_mut().unwrap() = var_c;

        self.add_selectors(selectors);
        self.constraint_variables.push(variables);
    }

    fn mul_constraint_c_opt(
        &mut self,
        (var_a, coeff_a, const_a): (usize, F, F),
        (var_b, coeff_b, const_b): (usize, F, F),
        variables_c: &[(usize, F)],
    ) {
        let (var_idx_a, var_idx_b, selector_a, selector_b, selector_mul) =
            self.gate.vanilla_compatibility_info;

        let selector_len = self.gate.num_selector_columns();
        let mut selectors = vec![F::zero(); selector_len];
        selectors[selector_a] = const_b * coeff_a;
        selectors[selector_b] = const_a * coeff_b;
        selectors[selector_mul] = coeff_a * coeff_b;
        *selectors.last_mut().unwrap() = const_a * const_b;

        let mut variables = vec![0; self.gate.num_witness_columns()];
        variables[var_idx_a] = var_a;
        variables[var_idx_b] = var_b;

        let mut linear_terms = self.gate.linear_terms.clone();
        linear_terms.push((variables.len() - 1, selectors.len() - 2));

        for (var, coeff) in variables_c {
            if *var == 0 {
                *selectors.last_mut().unwrap() -= coeff;
            } else if *var == var_a {
                selectors[selector_a] -= coeff;
            } else if *var == var_b {
                selectors[selector_b] -= coeff;
            } else {
                if let Some(var_index) = variables.iter().position(|it| *it == *var) {
                    let (_, selector_index) = linear_terms
                        .iter()
                        .find(|(it_var_idx, _)| *it_var_idx == var_index)
                        .unwrap();
                    selectors[*selector_index] -= coeff;
                } else {
                    let (var_index, selector_index) = linear_terms
                        .iter()
                        .find(|(it_var_idx, _)| variables[*it_var_idx] == 0)
                        .unwrap();
                    variables[*var_index] = *var;
                    selectors[*selector_index] -= coeff;
                }
            }
        }
        self.add_selectors(selectors);
        self.constraint_variables.push(variables);
    }

    fn lc_sum(&mut self, variables: &[(usize, F)]) -> (usize, F, F) {
        if variables.len() == 0 {
            return (0, F::zero(), F::zero());
        }

        let mut constant = F::zero();
        let mut pending_terms = vec![];
        for (var, coeff) in variables {
            if *var == 0 {
                constant += *coeff;
            } else if !coeff.is_zero() {
                pending_terms.push((*var, *coeff));
                if pending_terms.len() >= self.gate.linear_terms.len() {
                    pending_terms = vec![self.addition(&pending_terms)];
                }
            }
        }
        if pending_terms.len() > 1 {
            pending_terms = vec![self.addition(&pending_terms)];
        }
        if pending_terms.is_empty() {
            (0, F::zero(), constant)
        } else {
            (pending_terms[0].0, pending_terms[0].1, constant)
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
        let mut pending_terms = vec![];
        for (var, coeff) in variables {
            if *var != 0 && *var != var_a && *var != var_b && !coeff.is_zero() {
                pending_terms.push((*var, *coeff));
                if pending_terms.len() >= self.gate.linear_terms.len() {
                    pending_terms = vec![self.addition(&pending_terms)];
                }
            }
        }
        if pending_terms.len() > 1 {
            pending_terms = vec![self.addition(&pending_terms)];
        }
        if !pending_terms.is_empty() {
            terms.push(pending_terms[0]);
        }
        terms
    }
}

impl<F: PrimeField> GeneralPlonkifer<F> for NaiveLinearOnlyGeneralPlonkifier<F> {
    fn plonkify(r1cs: &R1CSFile<F>, gate: &CustomizedGates) -> (PlonkishCircuit<F>, Vec<F>) {
        let mut data = Self {
            gate: GateInfo::new(gate).unwrap(),
            constraint_selectors: vec![SelectorColumn::<F>(vec![]); gate.num_selector_columns()],
            constraint_variables: Vec::new(),
            variable_assignments: r1cs.witness.clone(),
        };

        // Create constraints for public inputs
        let num_public_inputs = r1cs.header.n_pub_in + r1cs.header.n_pub_out;
        for i in 0..num_public_inputs {
            data.add_selectors(vec![F::zero(); gate.num_selector_columns()]);
            let mut variables = vec![i as usize];
            variables.resize(gate.num_witness_columns(), 0);
            data.constraint_variables.push(variables);
        }

        for (a, b, c) in &r1cs.constraints {
            let value_a = data.lc_sum(&a);
            let value_b = data.lc_sum(&b);
            let c = data.lc_sum_c_opt(&c, value_a.0, value_b.0);
            data.mul_constraint_c_opt(value_a, value_b, &c);
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
                    gate_func: gate.clone(),
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

        let (plonkish_circuit, plonkish_witness) = NaiveLinearOnlyGeneralPlonkifier::<Fr>::plonkify(
            &file,
            &CustomizedGates::jellyfish_turbo_plonk_gate(),
        );
        assert!(plonkish_circuit.is_satisfied(&plonkish_witness));
    }
}

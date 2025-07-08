use crate::{
    circuit::{PlonkishCircuit, PlonkishCircuitParams},
    custom_gate::CustomizedGates,
    plonkify::Plonkifier,
    selectors::SelectorColumn,
};
use ark_ff::PrimeField;
use circom_compat::R1CSFile;

pub struct SimplePlonkifer<F: PrimeField> {
    constraint_selectors: Vec<SelectorColumn<F>>,
    constraint_variables: Vec<Vec<usize>>,
    variable_assignments: Vec<F>,
}

impl<F: PrimeField> SimplePlonkifer<F> {
    fn add_selectors(&mut self, values: Vec<F>) {
        for (i, selector) in values.iter().enumerate() {
            self.constraint_selectors[i].0.push(*selector);
        }
    }

    fn addition(
        &mut self,
        (var_a, coeff_a, const_a): (usize, F, F),
        (var_b, coeff_b, const_b): (usize, F, F),
    ) -> (usize, F, F) {
        if coeff_a == F::zero() {
            return (var_b, coeff_b, const_a + const_b);
        }
        if coeff_b == F::zero() {
            return (var_a, coeff_a, const_a + const_b);
        }

        self.add_selectors(vec![
            coeff_a,
            coeff_b,
            -F::one(),
            F::zero(),
            const_a + const_b,
        ]);

        let new_index = self.variable_assignments.len();
        self.variable_assignments.push(
            self.variable_assignments[var_a] * coeff_a
                + self.variable_assignments[var_b] * coeff_b
                + const_a
                + const_b,
        );

        self.constraint_variables
            .push(vec![var_a, var_b, new_index]);
        (new_index, F::one(), F::zero())
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
    ) {
        let mut selectors = vec![
            const_b * coeff_a,
            const_a * coeff_b,
            F::zero(),
            coeff_a * coeff_b,
            const_a * const_b,
        ];
        let mut var_c = 0usize;
        for (var, coeff) in variables_c {
            if *var == 0 {
                selectors[4] -= coeff;
            } else if *var == var_a {
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

    fn lc_sum(&mut self, variables: &[(usize, F)]) -> (usize, F, F) {
        if variables.len() == 0 {
            (0, F::zero(), F::zero())
        } else {
            let mut sum = (0, F::zero(), F::zero());
            for (var, coeff) in variables {
                if *var == 0 {
                    sum.2 += coeff;
                } else {
                    sum = self.addition(sum, (*var, *coeff, F::zero()));
                }
            }
            sum
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
        let mut sum = (0, F::zero(), F::zero());
        for (var, coeff) in variables {
            if *var != 0 && *var != var_a && *var != var_b && !coeff.is_zero() {
                sum = self.addition(sum, (*var, *coeff, F::zero()));
            }
        }
        terms.push((sum.0, sum.1));
        terms
    }
}

impl<F: PrimeField> Plonkifier<F> for SimplePlonkifer<F> {
    fn plonkify(r1cs: &R1CSFile<F>) -> (PlonkishCircuit<F>, Vec<F>) {
        let gate = CustomizedGates::vanilla_plonk_gate();
        let mut data = Self {
            constraint_selectors: vec![SelectorColumn::<F>(vec![]); gate.num_selector_columns()],
            constraint_variables: Vec::new(),
            variable_assignments: r1cs.witness.clone(),
        };

        // Create constraints for public inputs
        let num_public_inputs = r1cs.header.n_pub_in + r1cs.header.n_pub_out;
        for i in 0..num_public_inputs {
            data.add_selectors(vec![F::zero(), F::zero(), F::zero(), F::zero(), F::zero()]);
            data.constraint_variables.push(vec![i as usize, 0, 0]);
        }

        for (a, b, c) in &r1cs.constraints {
            let value_a = data.lc_sum(&a);
            let value_b = data.lc_sum(&b);
            let value_c = data.lc_sum_c_opt(&c, value_a.0, value_b.0);
            data.mul_constraint_c_opt(value_a, value_b, &value_c);
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

        let (plonkish_circuit, plonkish_witness) = SimplePlonkifer::<Fr>::plonkify(&file);
        assert!(plonkish_circuit.is_satisfied(&plonkish_witness));
    }

    #[test]
    fn test_sample_2() {
        let reader = BufReader::new(File::open("D:/Projects/circuit.r1cs").unwrap());
        let mut file = R1CSFile::<Fr>::new(reader).unwrap();
        println!("R1CS num constraints: {}", file.header.n_constraints);

        let witness_reader = BufReader::new(File::open("D:/Projects/witness.json").unwrap());
        file.witness = read_witness::<Fr>(witness_reader);

        let (plonkish_circuit, plonkish_witness) = SimplePlonkifer::<Fr>::plonkify(&file);
        println!(
            "Plonk num constraints: {}",
            plonkish_circuit.params.num_constraints
        );
        assert!(plonkish_circuit.is_satisfied(&plonkish_witness));
    }
}

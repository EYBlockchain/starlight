// Copyright (c) 2023 Espresso Systems (espressosys.com)
// This file is part of the HyperPlonk library.

// You should have received a copy of the MIT License
// along with the HyperPlonk library. If not, see <https://mit-license.org/>.

use ark_ff::PrimeField;
use ark_std::iterable::Iterable;
use std::cmp::max;
use std::collections::HashSet;

/// Customized gate is a list of tuples of
///     (coefficient, selector_index, wire_indices)
///
/// Example:
///     q_L(X) * W_1(X)^5 - W_2(X) = 0
/// is represented as
/// vec![
///     ( 1,    Some(id_qL),    vec![id_W1, id_W1, id_W1, id_W1, id_W1]),
///     (-1,    None,           vec![id_W2])
/// ]
///
/// CustomizedGates {
///     gates: vec![
///         (1, Some(0), vec![0, 0, 0, 0, 0]),
///         (-1, None, vec![1])
///     ],
/// };
/// where id_qL = 0 // first selector
/// id_W1 = 0 // first witness
/// id_w2 = 1 // second witness
///
/// NOTE: here coeff is a signed integer, instead of a field element
///
/// Customized gates structure from HyperPlonk.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct CustomizedGates {
    pub gates: Vec<(i64, Option<usize>, Vec<usize>)>,
}

impl CustomizedGates {
    /// The degree of the algebraic customized gate
    pub fn degree(&self) -> usize {
        let mut res = 0;
        for x in self.gates.iter() {
            res = max(res, x.2.len() + (x.1.is_some() as usize))
        }
        res
    }

    /// The number of selectors in a customized gate
    pub fn num_selector_columns(&self) -> usize {
        let mut res = 0;
        for (_coeff, q, _ws) in self.gates.iter() {
            // a same selector must not be used for multiple monomials.
            if q.is_some() {
                res += 1;
            }
        }
        res
    }

    /// The number of witnesses in a customized gate
    pub fn num_witness_columns(&self) -> usize {
        let mut res = 0;
        for (_coeff, _q, ws) in self.gates.iter() {
            // witness list must be ordered
            // so we just need to compare with the last one
            if let Some(&p) = ws.last() {
                if res < p {
                    res = p
                }
            }
        }
        // add one here because index starts from 0
        res + 1
    }

    pub fn evaluate<F: PrimeField>(&self, selectors: &[F], witness: &[F]) -> F {
        let mut res = F::zero();
        for (coeff, q, ws) in self.gates.iter() {
            let mut term = if *coeff < 0 {
                -F::from_u64((-coeff) as u64).unwrap()
            } else {
                F::from_u64(*coeff as u64).unwrap()
            };
            if let Some(selector_idx) = q {
                term *= selectors[*selector_idx];
            }
            for witness_idx in ws {
                term *= witness[*witness_idx];
            }
            res += term;
        }
        res
    }

    /// Return a vanilla plonk gate:
    /// ``` ignore
    ///   q_L w_1 + q_R w_2 + q_O w_3 + q_M w1w2 + q_C = 0
    /// ```
    /// which is
    /// ``` ignore
    ///     (1,    Some(id_qL),     vec![id_W1]),
    ///     (1,    Some(id_qR),     vec![id_W2]),
    ///     (1,    Some(id_qO),     vec![id_W3]),
    ///     (1,    Some(id_qM),     vec![id_W1, id_w2]),
    ///     (1,    Some(id_qC),     vec![]),
    /// ```
    pub fn vanilla_plonk_gate() -> Self {
        Self {
            gates: vec![
                (1, Some(0), vec![0]),
                (1, Some(1), vec![1]),
                (1, Some(2), vec![2]),
                (1, Some(3), vec![0, 1]),
                (1, Some(4), vec![]),
            ],
        }
    }

    /// Return a jellyfish turbo plonk gate:
    /// ```ignore
    ///     q_1 w_1   + q_2 w_2   + q_3 w_3   + q_4 w4
    ///   + q_M1 w1w2 + q_M2 w3w4
    ///   + q_H1 w1^5 + q_H2 w2^5 + q_H3 w3^5 + q_H4 w4^5
    ///   + q_E w1w2w3w4
    ///   + q_O w5
    ///   + q_C
    ///   = 0
    /// ```
    /// with
    /// - w = [w1, w2, w3, w4, w5]
    /// - q = [ q_1, q_2, q_3, q_4, q_M1, q_M2, q_H1, q_H2, q_H3, q_H4, q_E,
    ///   q_O, q_c ]
    ///
    /// which is
    /// ```ignore
    ///     (1,    Some(q[0]),     vec![w[0]]),
    ///     (1,    Some(q[1]),     vec![w[1]]),
    ///     (1,    Some(q[2]),     vec![w[2]]),
    ///     (1,    Some(q[3]),     vec![w[3]]),
    ///     (1,    Some(q[4]),     vec![w[0], w[1]]),
    ///     (1,    Some(q[5]),     vec![w[2], w[3]]),
    ///     (1,    Some(q[6]),     vec![w[0], w[0], w[0], w[0], w[0]]),
    ///     (1,    Some(q[7]),     vec![w[1], w[1], w[1], w[1], w[1]]),
    ///     (1,    Some(q[8]),     vec![w[2], w[2], w[2], w[2], w[2]]),
    ///     (1,    Some(q[9]),     vec![w[3], w[3], w[3], w[3], w[3]]),
    ///     (1,    Some(q[10]),    vec![w[0], w[1], w[2], w[3]]),
    ///     (1,    Some(q[11]),    vec![w[4]]),
    ///     (1,    Some(q[12]),    vec![]),
    /// ```
    pub fn jellyfish_turbo_plonk_gate() -> Self {
        CustomizedGates {
            gates: vec![
                (1, Some(0), vec![0]),
                (1, Some(1), vec![1]),
                (1, Some(2), vec![2]),
                (1, Some(3), vec![3]),
                (1, Some(4), vec![0, 1]),
                (1, Some(5), vec![2, 3]),
                (1, Some(6), vec![0, 0, 0, 0, 0]),
                (1, Some(7), vec![1, 1, 1, 1, 1]),
                (1, Some(8), vec![2, 2, 2, 2, 2]),
                (1, Some(9), vec![3, 3, 3, 3, 3]),
                (1, Some(10), vec![0, 1, 2, 3]),
                (1, Some(11), vec![4]),
                (1, Some(12), vec![]),
            ],
        }
    }

    /// Generate a random gate for `num_witness` with a highest degree =
    /// `degree`
    pub fn mock_gate(num_witness: usize, degree: usize) -> Self {
        let mut gates = vec![];

        let mut high_degree_term = vec![0; degree - 1];
        high_degree_term.push(1);

        gates.push((1, Some(0), high_degree_term));
        for i in 0..num_witness {
            gates.push((1, Some(i + 1), vec![i]))
        }
        gates.push((1, Some(num_witness + 1), vec![]));

        CustomizedGates { gates }
    }

    /// Return a plonk gate where #selector > #witness * 2
    /// ``` ignore
    ///   q_1 w_1   + q_2 w_2   + q_3 w_3   +
    ///   q_4 w1w2  + q_5 w1w3  + q_6 w2w3  +
    ///   q_7 = 0
    /// ```
    /// which is
    /// ``` ignore
    ///     (1,    Some(id_qL),     vec![id_W1]),
    ///     (1,    Some(id_qR),     vec![id_W2]),
    ///     (1,    Some(id_qO),     vec![id_W3]),
    ///     (1,    Some(id_qM),     vec![id_W1, id_w2]),
    ///     (1,    Some(id_qC),     vec![]),
    /// ```
    pub fn super_long_selector_gate() -> Self {
        Self {
            gates: vec![
                (1, Some(0), vec![0]),
                (1, Some(1), vec![1]),
                (1, Some(2), vec![2]),
                (1, Some(3), vec![0, 1]),
                (1, Some(4), vec![0, 2]),
                (1, Some(5), vec![1, 2]),
                (1, Some(6), vec![]),
            ],
        }
    }

    pub fn super_long_selector_gate_with_output() -> Self {
        Self {
            gates: vec![
                (1, Some(0), vec![0]),
                (1, Some(1), vec![1]),
                (1, Some(2), vec![2]),
                (1, Some(3), vec![0, 1]),
                (1, Some(4), vec![0, 2]),
                (1, Some(5), vec![1, 2]),
                (1, Some(6), vec![3]),
                (1, Some(7), vec![]),
            ],
        }
    }
}

// Gate structure that we use
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct GateInfo {
    pub gates: Vec<Vec<(usize, usize)>>,
    pub is_linear: Vec<bool>,
    // This describes the 'equivalence' of the variables
    // Assuming that the variables are sorted, e.g. [1, 2, 3, 4], which
    // orders should we try to cover all possiblilities? If all variables
    // are equivalent, there is only one order required ([0, 1, 2, 3])
    pub orders: Vec<Vec<usize>>,
    // (var, selector)
    pub linear_terms: Vec<(usize, usize)>,
    // For linear-only; (var1, var2, selector_1, selector_2, selector_mul)
    pub vanilla_compatibility_info: (usize, usize, usize, usize, usize),
}

impl GateInfo {
    /// The number of selectors in a customized gate
    pub fn num_selector_columns(&self) -> usize {
        // Output gate and constant gate
        self.gates.len() + 2
    }

    /// The number of witnesses in a customized gate
    pub fn num_witness_columns(&self) -> usize {
        let mut res = 0;
        for ws in self.gates.iter() {
            // witness list must be ordered
            // so we just need to compare with the last one
            if let Some(&(var, _)) = ws.last() {
                if res < var {
                    res = var
                }
            }
        }
        // add one here because index starts from 0
        // and one more here because the output is not included
        res + 2
    }

    fn next_permutation<T: Ord>(v: &mut [T]) -> bool {
        if v.len() == 1 {
            return false;
        }
        let mut i = v.len() - 1;
        while i > 0 {
            i -= 1;
            if v[i] < v[i + 1] {
                let mut j = v.len() - 1;
                while v[i] >= v[j] {
                    j -= 1;
                }
                v.swap(i, j);

                let mut low = i + 1;
                let mut high = v.len() - 1;
                while low < high {
                    v.swap(low, high);
                    low += 1;
                    high -= 1;
                }
                return true;
            }
        }
        return false;
    }

    pub fn new(gate: &CustomizedGates) -> Result<Self, String> {
        let mut gates = vec![];
        for (coeff, selector, variables) in &gate.gates {
            if *coeff != 1 {
                return Err("Non-1 coeff is currently unsupported".to_string());
            }
            if let Some(selector_idx) = selector {
                if *selector_idx != gates.len() {
                    return Err("Some selector indices appear to be skipped".to_string());
                }
                let mut out_gate = vec![];
                for i in 0..variables.len() {
                    if i == 0 || variables[i] != variables[i - 1] {
                        out_gate.push((variables[i], 0usize));
                    }
                    out_gate.last_mut().unwrap().1 += 1;
                }
                gates.push(out_gate);
            } else {
                return Err("Missing selector is currently unsupported".to_string());
            }
        }
        if !gates.last().unwrap().is_empty() {
            return Err("Missing constant term".to_string());
        }
        let output_term = gates[gates.len() - 2].clone();
        if output_term.len() != 1
            || output_term[0].1 != 1
            || output_term[0].0 != gate.num_witness_columns() - 1
        {
            return Err("Output term is not in proper form".to_string());
        }
        gates.truncate(gates.len() - 2);

        let is_linear = gates
            .iter()
            .map(|gate| gate.len() == 1 && gate[0].1 == 1)
            .collect::<Vec<_>>();
        let linear_terms = gates
            .iter()
            .enumerate()
            .flat_map(|(selector_idx, gate)| {
                if gate.len() == 1 && gate[0].1 == 1 {
                    Some((gate[0].0, selector_idx))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        let var_a = linear_terms[0].0;
        let var_b = linear_terms[1].0;
        let mul_selector = gates
            .iter()
            .position(|gate| *gate == vec![(var_a, 1), (var_b, 1)])
            .ok_or("Failed to find multiplication term".to_string())?;
        let vanilla_compatibility_info = (
            var_a,
            var_b,
            linear_terms[0].1,
            linear_terms[1].1,
            mul_selector,
        );

        let mut perm = (0..(gate.num_witness_columns() - 1)).collect::<Vec<_>>();
        let mut orders = vec![];
        let mut effective_gates_set = HashSet::new();
        loop {
            let mut effective_gates = gates
                .iter()
                .map(|gate| {
                    let mut new_gate = gate
                        .iter()
                        .flat_map(|(var, power)| {
                            if *var == perm.len() {
                                None
                            } else {
                                Some((perm[*var], *power))
                            }
                        })
                        .collect::<Vec<_>>();
                    new_gate.sort();
                    new_gate
                })
                .collect::<Vec<_>>();
            effective_gates.sort();
            if effective_gates_set.insert(effective_gates) {
                orders.push(perm.clone());
            }

            if !Self::next_permutation(&mut perm) {
                break;
            }
        }

        Ok(GateInfo {
            gates,
            is_linear,
            orders,
            linear_terms,
            vanilla_compatibility_info,
        })
    }

    pub fn jellyfish_turbo_plonk_gate() -> Self {
        Self {
            gates: vec![
                (vec![(0, 1)]),
                (vec![(1, 1)]),
                (vec![(2, 1)]),
                (vec![(3, 1)]),
                (vec![(0, 1), (1, 1)]),
                (vec![(2, 1), (3, 1)]),
                (vec![(0, 5)]),
                (vec![(1, 5)]),
                (vec![(2, 5)]),
                (vec![(3, 5)]),
                (vec![(0, 1), (1, 1), (2, 1), (3, 1)]),
            ],
            is_linear: vec![
                true, true, true, true, false, false, false, false, false, false, false,
            ],
            // gate_priority: vec![6, 7, 8, 9, 10, 4, 5, 0, 1, 2, 3],
            orders: vec![vec![0, 1, 2, 3], vec![0, 2, 1, 3], vec![1, 2, 0, 3]],
            linear_terms: vec![(0, 0), (1, 1), (2, 2), (3, 3)],
            vanilla_compatibility_info: (0, 1, 0, 1, 4),
        }
    }

    pub fn evaluate_no_output<F: PrimeField>(
        &self,
        selectors: &[F],
        witness: &[F],
        variables: &[usize],
    ) -> F {
        self.gates
            .iter()
            .zip(selectors.iter())
            .map(|(gate, selector)| {
                if selector.is_zero() {
                    F::zero()
                } else {
                    gate.iter()
                        .map(|(idx, power)| witness[variables[*idx]].pow([*power as u64]))
                        .product::<F>()
                        * selector
                }
            })
            .sum::<F>()
            + selectors.last().unwrap()
    }

    pub fn evaluate<F: PrimeField>(
        &self,
        selectors: &[F],
        witness: &[F],
        variables: &[usize],
    ) -> F {
        let selector_len = selectors.len();
        self.gates
            .iter()
            .zip(selectors.iter())
            .map(|(gate, selector)| {
                if selector.is_zero() {
                    F::zero()
                } else {
                    gate.iter()
                        .map(|(idx, power)| witness[variables[*idx]].pow([*power as u64]))
                        .product::<F>()
                        * selector
                }
            })
            .sum::<F>()
            + selectors[selector_len - 2] * witness[*variables.last().unwrap()]
            + selectors.last().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gate_info() {
        let generated_gate_info =
            GateInfo::new(&CustomizedGates::jellyfish_turbo_plonk_gate()).unwrap();
        let expected_gate_info = GateInfo {
            gates: vec![
                (vec![(0, 1)]),
                (vec![(1, 1)]),
                (vec![(2, 1)]),
                (vec![(3, 1)]),
                (vec![(0, 1), (1, 1)]),
                (vec![(2, 1), (3, 1)]),
                (vec![(0, 5)]),
                (vec![(1, 5)]),
                (vec![(2, 5)]),
                (vec![(3, 5)]),
                (vec![(0, 1), (1, 1), (2, 1), (3, 1)]),
            ],
            is_linear: vec![
                true, true, true, true, false, false, false, false, false, false, false,
            ],
            orders: vec![vec![0, 1, 2, 3], vec![0, 2, 1, 3], vec![0, 3, 1, 2]],
            linear_terms: vec![(0, 0), (1, 1), (2, 2), (3, 3)],
            vanilla_compatibility_info: (0, 1, 0, 1, 4),
        };
        assert_eq!(generated_gate_info, expected_gate_info);
    }

    #[test]
    fn test_gate_info_2() {
        let generated_gate_info =
            GateInfo::new(&CustomizedGates::super_long_selector_gate_with_output()).unwrap();
        let expected_gate_info = GateInfo {
            gates: vec![
                (vec![(0, 1)]),
                (vec![(1, 1)]),
                (vec![(2, 1)]),
                (vec![(0, 1), (1, 1)]),
                (vec![(0, 1), (2, 1)]),
                (vec![(1, 1), (2, 1)]),
            ],
            is_linear: vec![true, true, true, false, false, false],
            orders: vec![vec![0, 1, 2]],
            linear_terms: vec![(0, 0), (1, 1), (2, 2)],
            vanilla_compatibility_info: (0, 1, 0, 1, 3),
        };
        assert_eq!(generated_gate_info, expected_gate_info);
    }
}

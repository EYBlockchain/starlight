// Copyright (c) 2023 Espresso Systems (espressosys.com)
// This file is part of the HyperPlonk library.

// You should have received a copy of the MIT License
// along with the HyperPlonk library. If not, see <https://mit-license.org/>.

//! Main module for the HyperPlonk PolyIOP.

use crate::custom_gate::CustomizedGates;
use crate::selectors::SelectorColumn;
use ark_ff::PrimeField;
use rayon::prelude::*;

/// The HyperPlonk instance parameters, consists of the following:
///   - the number of constraints
///   - number of public input columns
///   - the customized gate function
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PlonkishCircuitParams {
    /// the number of constraints for gate_func
    pub num_constraints: usize,
    /// number of public input
    // public input is only 1 column and is implicitly the first witness column.
    // this size must not exceed number of total constraints.
    // Beware that public input must be wired to regular gates. If public input
    // needs to be wired to lookup gates an no-op regular gate is necessary
    pub num_pub_input: usize,
    /// customized gate function
    pub gate_func: CustomizedGates,
}

/// The HyperPlonk index, consists of the following:
///   - HyperPlonk parameters
///   - the wire permutation
///   - the selector vectors
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PlonkishCircuit<F: PrimeField> {
    pub params: PlonkishCircuitParams,
    pub permutation: Vec<F>,
    pub selectors: Vec<SelectorColumn<F>>,
}

impl<F: PrimeField> PlonkishCircuit<F> {
    fn witness_row(&self, values: &[F], idx: usize) -> Vec<F> {
        let mut witness_values = vec![F::zero(); self.params.gate_func.num_witness_columns()];
        for i in 0..witness_values.len() {
            witness_values[i] = values[i * self.params.num_constraints + idx];
        }
        witness_values
    }

    fn selector_row(&self, idx: usize) -> Vec<F> {
        let mut selector_values = vec![F::zero(); self.selectors.len()];
        for (i, column) in self.selectors.iter().enumerate() {
            selector_values[i] = column.0[idx];
        }
        selector_values
    }

    pub fn is_satisfied(&self, values: &[F]) -> bool {
        let gate_constraint = (0..self.params.num_constraints).into_par_iter().all(|i| {
            self.params
                .gate_func
                .evaluate(&self.selector_row(i), &self.witness_row(values, i))
                == F::zero()
        });
        if !gate_constraint {
            return false;
        }

        let wiring_constraint = (0..self.permutation.len()).into_par_iter().all(|i| {
            let next_idx_val = self.permutation[i].into_bigint();
            let next_idx = next_idx_val.as_ref();
            if !next_idx.iter().skip(1).all(|&e| e == 0) {
                return false;
            }
            if values[i] != values[next_idx[0] as usize] {
                return false;
            }
            true
        });
        wiring_constraint
    }
}

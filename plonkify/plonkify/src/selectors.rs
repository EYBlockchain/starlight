// Copyright (c) 2023 Espresso Systems (espressosys.com)
// This file is part of the HyperPlonk library.

// You should have received a copy of the MIT License
// along with the HyperPlonk library. If not, see <https://mit-license.org/>.

use ark_ff::PrimeField;
use ark_std::log2;

/// A row of selector of width `#selectors`
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectorRow<F: PrimeField>(pub Vec<F>);

/// A column of selectors of length `#constraints`
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SelectorColumn<F: PrimeField>(pub Vec<F>);

impl<F: PrimeField> SelectorColumn<F> {
    /// the number of variables of the multilinear polynomial that presents a
    /// column.
    pub fn get_nv(&self) -> usize {
        log2(self.0.len()) as usize
    }

    /// Append a new element to the selector column
    pub fn append(&mut self, new_element: F) {
        self.0.push(new_element)
    }

    /// Build selector columns from rows
    pub fn from_selector_rows(
        selector_rows: &[SelectorRow<F>],
    ) -> Result<Vec<Self>, String> {
        if selector_rows.is_empty() {
            return Err(
                "empty witness rows".to_string(),
            );
        }

        let mut res = Vec::with_capacity(selector_rows.len());
        let num_colnumns = selector_rows[0].0.len();

        for i in 0..num_colnumns {
            let mut cur_column = Vec::new();
            for row in selector_rows.iter() {
                cur_column.push(row.0[i])
            }
            res.push(Self(cur_column))
        }

        Ok(res)
    }
}

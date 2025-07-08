use ark_ff::PrimeField;
use ark_std::{iter, Zero};
use crate::selectors::SelectorColumn as PlonkSel;
use hyperplonk::prelude::SelectorColumn;

/// Pads `permutation` into blocks of `num_rows` with `padding`, up to `expected_length`.
pub fn pad_permutation_field<F: PrimeField>(
    mut perm: Vec<F>,
    num_rows: usize,
    padding: usize,
    expected_len: usize,
) -> Vec<F> {
    let mut offset = 0;
    let mut start = 0;
    while start + num_rows <= perm.len() {
        let insert_at = start + num_rows + offset;
        perm.splice(insert_at..insert_at, iter::repeat(F::zero()).take(padding));
        for val in &mut perm {
            let idx = val.into_bigint().as_ref()[0] as usize;
            if idx >= insert_at {
                *val = F::from((idx + padding) as u64);
            }
        }
        for i in 0..padding {
            let idx = insert_at + i;
            let next = insert_at + (i + 1) % padding;
            perm[idx] = F::from(next as u64);
        }
        offset += padding;
        start += num_rows;
    }
    let pad_start = perm.len();
    perm.extend(iter::repeat(F::zero()).take(expected_len - pad_start));
    let indices: Vec<usize> = (pad_start..expected_len).collect();
    for (i, &idx) in indices.iter().enumerate() {
        let next = indices[(i + 1) % indices.len()];
        perm[idx] = F::from(next as u64);
    }
    perm
}

/// Validates that `perm` over `witnesses` forms disjoint cycles covering all indices.
pub fn check_permutation<F: PrimeField>(
    witnesses: &[F],
    perm: &[F],
    _num_rows: usize,
) -> bool {
    let len = witnesses.len();
    if perm.len() != len {
        eprintln!("Permutation length mismatch: expected {}, got {}", len, perm.len());
        return false;
    }
    for &p in perm {
        let idx = p.into_bigint().as_ref()[0] as usize;
        if idx >= len {
            eprintln!("Invalid index {} (>= {})", idx, len);
            return false;
        }
    }
    let mut seen = vec![false; len];
    for start in 0..len {
        if seen[start] { continue; }
        let mut cur = start;
        let mut cycle_len = 0;
        loop {
            if seen[cur] {
                eprintln!("Premature cycle closure at {}", cur);
                return false;
            }
            seen[cur] = true;
            cycle_len += 1;
            let next = perm[cur].into_bigint().as_ref()[0] as usize;
            if next == start { break; }
            cur = next;
        }
        if cycle_len == 0 {
            eprintln!("Zero-length cycle at {}", start);
            return false;
        }
    }
    seen.into_iter().all(|x| x)
}

/// Converts plonkify selectors into hyperplonk selectors with power-of-two padding.
pub fn convert_selectors(
    sels: Vec<PlonkSel<ark_bn254::Fr>>,
) -> Vec<SelectorColumn<ark_bn254::Fr>> {
    sels.into_iter()
        .map(|mut s| {
            let targ = s.0.len().next_power_of_two();
            s.0.resize(targ, ark_bn254::Fr::zero());
            SelectorColumn(s.0)
        })
        .collect()
}

/// Converts plonkish circuit parameters into hyperplonk parameters.
pub fn convert_params(
    params: crate::circuit::PlonkishCircuitParams,
) -> hyperplonk::structs::HyperPlonkParams {
    hyperplonk::structs::HyperPlonkParams {
        num_constraints: params.num_constraints,
        num_pub_input: params.num_pub_input,
        gate_func: hyperplonk::custom_gate::CustomizedGates { gates: params.gate_func.gates },
    }
}

/// Splits a flat witness into columns with padding to power-of-two rows.
pub fn split_flat_witness<F: Clone + Zero>(
    flat: &[F],
    num_cols: usize,
    num_rows: usize,
    num_pub: usize,
) -> Vec<Vec<F>> {
    let pad = num_pub.next_power_of_two() - num_pub;
    let rows = (num_rows + pad).next_power_of_two();
    let mut cols = vec![Vec::with_capacity(rows); num_cols];
    for w in 0..num_cols {
        cols[w].extend_from_slice(&flat[w * num_rows..w * num_rows + num_pub]);
        cols[w].extend(iter::repeat(F::zero()).take(pad));
        cols[w].extend_from_slice(&flat[w * num_rows + num_pub..(w + 1) * num_rows]);
        cols[w].resize(rows, F::zero());
    }
    cols
}

/// Flattens a matrix of witness columns
pub fn flatten_witness_matrix<F: Clone>(cols: &[Vec<F>]) -> Vec<F> {
    cols.iter().flat_map(|c| c.clone()).collect()
}

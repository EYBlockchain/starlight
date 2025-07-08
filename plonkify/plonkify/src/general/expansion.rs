use ark_ff::{PrimeField, Zero};
use ark_poly::{
    multivariate::{SparsePolynomial, SparseTerm, Term},
    DenseMVPolynomial, Polynomial,
};
use circom_compat::R1CSFile;
use rayon::prelude::*;
use std::collections::{BTreeSet, BinaryHeap, HashMap};
use std::iter::zip;
use std::mem::take;
use std::{cmp::Reverse, collections::BTreeMap};

pub(super) fn term_mul_by_term(cur: &SparseTerm, other: &SparseTerm) -> SparseTerm {
    if cur.is_empty() {
        return other.clone();
    }
    if other.is_empty() {
        return cur.clone();
    }
    SparseTerm::new((**cur).iter().chain((**other).iter()).map(|x| *x).collect())
}

pub(super) fn poly_mul_by_term<F: PrimeField>(
    cur: &mut SparsePolynomial<F, SparseTerm>,
    coeff: F,
    other: &SparseTerm,
) {
    // Note: the sparse polynomial is sorted; multiplying by the same term does not affect the ordering
    cur.terms.iter_mut().for_each(|(cur_coeff, cur_term)| {
        *cur_coeff *= coeff;
        *cur_term = term_mul_by_term(cur_term, other);
    });
}

pub(super) fn naive_mul<F: PrimeField>(
    cur: &SparsePolynomial<F, SparseTerm>,
    other: &SparsePolynomial<F, SparseTerm>,
) -> SparsePolynomial<F, SparseTerm> {
    if cur.is_zero() || other.is_zero() {
        SparsePolynomial::zero()
    } else {
        let mut result_terms = Vec::new();
        for (cur_coeff, cur_term) in cur.terms.iter() {
            for (other_coeff, other_term) in other.terms.iter() {
                result_terms.push((
                    *cur_coeff * *other_coeff,
                    term_mul_by_term(cur_term, other_term),
                ));
            }
        }
        SparsePolynomial::from_coefficients_vec(cur.num_vars, result_terms)
    }
}

fn substitute<F: PrimeField>(
    cur: &SparsePolynomial<F, SparseTerm>,
    variable: usize,
    subst: &SparsePolynomial<F, SparseTerm>,
) -> Option<SparsePolynomial<F, SparseTerm>> {
    let is_zero = subst.is_zero();
    let is_single_term = subst.terms.len() <= 1;
    let mut already_used = false;

    let mut result_terms = Vec::new();
    for (coeff, term) in cur.terms.iter() {
        let item_to_subst = (**term).iter().find(|(var, _)| *var == variable);
        if let Some((_, power)) = item_to_subst {
            if is_zero {
                continue;
            }
            if is_single_term {
                let new_term = SparseTerm::new(
                    (**term)
                        .iter()
                        .filter(|(var, _)| *var != variable)
                        .map(|x| *x)
                        .chain(subst.terms[0].1.iter().map(|(x, y)| (*x, *y * *power)))
                        .collect::<Vec<_>>(),
                );
                if *power == 1 {
                    result_terms.push((*coeff * subst.terms[0].0, new_term));
                } else {
                    result_terms.push((*coeff * subst.terms[0].0.pow([*power as u64]), new_term));
                }
                continue;
            }

            if *power > 1 || already_used {
                // It's probably not worth it to inline
                return None;
            }
            already_used = true;

            let mut new_poly = subst.clone();
            let remainder_term = SparseTerm::new(
                (**term)
                    .iter()
                    .filter(|(var, _)| *var != variable)
                    .map(|x| *x)
                    .collect::<Vec<_>>(),
            );
            poly_mul_by_term(&mut new_poly, *coeff, &remainder_term);
            result_terms.append(&mut new_poly.terms);
        } else {
            result_terms.push((*coeff, term.clone()));
        }
    }
    Some(SparsePolynomial::from_coefficients_vec(
        cur.num_vars,
        result_terms,
    ))
}

pub struct ExpandedCircuit<F: PrimeField> {
    pub num_public_inputs: usize,
    pub constraints: Vec<SparsePolynomial<F, SparseTerm>>,
    pub witness: Vec<F>,
}

fn get_poly_weight<F: PrimeField>(poly: &SparsePolynomial<F, SparseTerm>) -> usize {
    poly.terms
        .iter()
        .map(|(_, term)| (**term).iter().map(|(_, deg)| *deg).sum::<usize>())
        .sum()
}

pub enum ExpansionConfig {
    None,
    MaxWidthDegree((usize, usize)),
    MaxCost(usize),
}

impl ExpansionConfig {
    fn check_poly<F: PrimeField>(&self, poly: &SparsePolynomial<F, SparseTerm>) -> bool {
        match self {
            ExpansionConfig::None => true,
            ExpansionConfig::MaxWidthDegree((width, degree)) => {
                poly.terms.len() <= *width && poly.degree() <= *degree
            }
            ExpansionConfig::MaxCost(max_cost) => get_poly_weight(poly) <= *max_cost,
        }
    }
}

impl<F: PrimeField> ExpandedCircuit<F> {
    fn poly_from_lc(lc: &[(usize, F)]) -> SparsePolynomial<F, SparseTerm> {
        // num_vars don't actually matter at all.. except for being checked
        SparsePolynomial::from_coefficients_vec(
            usize::MAX,
            lc.iter()
                .map(|(var, coeff)| {
                    if *var == 0 {
                        (*coeff, SparseTerm::new(vec![]))
                    } else {
                        (*coeff, SparseTerm::new(vec![(*var, 1)]))
                    }
                })
                .collect(),
        )
    }

    fn evaluate_lc(lc: &[(usize, F)], witness: &[F]) -> F {
        lc.iter()
            .map(|(var, coeff)| *coeff * witness[*var])
            .sum::<F>()
    }

    // (linear terms, dependencies)
    fn get_constraint_dependencies(
        num_public_input: usize,
        constraint_poly: &SparsePolynomial<F, SparseTerm>,
    ) -> (BTreeSet<usize>, BTreeMap<usize, usize>) {
        let mut linear_terms = BTreeSet::new();
        let mut high_order_dependencies = BTreeSet::new();
        let mut total_counts = BTreeMap::new();
        for (_, term) in &constraint_poly.terms {
            for (var, deg) in &**term {
                if *var < num_public_input {
                    continue;
                }

                total_counts
                    .entry(*var)
                    .and_modify(|prev_count| *prev_count += 1)
                    .or_insert(1);
                if *deg > 1 || term.len() > 1 {
                    linear_terms.remove(var);
                    high_order_dependencies.insert(*var);
                } else {
                    if !high_order_dependencies.contains(var) {
                        linear_terms.insert(*var);
                    }
                }
            }
        }
        total_counts.retain(|var, _| high_order_dependencies.contains(var));
        (linear_terms, total_counts)
    }

    fn solve_for_variable(
        mut poly: SparsePolynomial<F, SparseTerm>,
        variable: usize,
    ) -> SparsePolynomial<F, SparseTerm> {
        let (divisor, _) = poly
            .terms
            .iter()
            .find(|(_, term)| term.len() == 1 && term[0].0 == variable)
            .unwrap();
        let multiplier = -divisor.inverse().unwrap();

        poly.terms.retain_mut(|(coeff, term)| {
            if term.len() == 1 && term[0].0 == variable {
                false
            } else {
                *coeff *= multiplier;
                true
            }
        });
        poly
    }

    // const HASH_BASE_1: u64 = 97;
    // const HASH_BASE_2: u64 = 389;
    // const HASH_MODULUS: u64 = 1610612741;

    // fn get_hash_value(coeff: &F, term: &SparseTerm) -> u64 {
    //     let mut out = 0;
    //     for limb in coeff.into_bigint().as_ref() {
    //         out = (out * Self::HASH_BASE_1 + *limb) % Self::HASH_MODULUS;
    //     }
    //     for (var, power) in &**term {
    //         out = (out * Self::HASH_BASE_1 + (*var as u64)) % Self::HASH_MODULUS;
    //         out = (out * Self::HASH_BASE_1 + (*power as u64)) % Self::HASH_MODULUS;
    //     }
    //     out
    // }

    // fn get_hash_prefix(poly: &SparsePolynomial<F, SparseTerm>) -> Vec<u64> {
    //     assert!(!poly.terms.is_empty());

    //     let mut out_values = Vec::with_capacity(poly.terms.len());
    //     let mut cur_value = 0;
    //     let multiplier = poly.terms[0].0.inverse().unwrap();
    //     for (coeff, term) in &poly.terms {
    //         cur_value = (cur_value * Self::HASH_BASE_2
    //             + Self::get_hash_value(&(*coeff * multiplier), term))
    //             % Self::HASH_MODULUS;
    //         out_values.push(cur_value);
    //     }
    //     out_values
    // }

    fn try_optimize_lc(
        sub_poly: &SparsePolynomial<F, SparseTerm>,
        parent_poly: &mut SparsePolynomial<F, SparseTerm>,
    ) -> bool {
        if parent_poly.terms.len() < sub_poly.terms.len() || sub_poly.terms.len() <= 2 {
            return false;
        }
        let parent_poly_last_term = &parent_poly.terms[parent_poly.terms.len() - 2].1;
        let sub_poly_last_term = &sub_poly.terms[sub_poly.terms.len() - 2].1;
        if parent_poly_last_term < sub_poly_last_term {
            return false;
        }

        let mut sub_idx = 0;
        let mut result_terms = vec![];
        let mut multiplier = F::zero();
        for (coeff, term) in &parent_poly.terms[..parent_poly.terms.len() - 1] {
            if sub_idx >= sub_poly.terms.len() - 1 {
                result_terms.push((*coeff, term.clone()));
                continue;
            }

            let (sub_coeff, sub_term) = &sub_poly.terms[sub_idx];
            if sub_term < term {
                // We are missing terms
                return false;
            }
            if sub_term > term {
                result_terms.push((*coeff, term.clone()));
                continue;
            }

            if multiplier.is_zero() {
                multiplier = *coeff * sub_coeff.inverse().unwrap();
            } else if *sub_coeff * multiplier != *coeff {
                return false;
            }
            sub_idx += 1;
        }
        if sub_idx < sub_poly.terms.len() - 1 {
            return false;
        }
        let (last_coeff, last_term) = sub_poly.terms.last().unwrap();
        result_terms.push((-*last_coeff * multiplier, last_term.clone()));
        result_terms.push(parent_poly.terms.last().unwrap().clone());
        *parent_poly = SparsePolynomial::from_coefficients_vec(parent_poly.num_vars, result_terms);

        true
    }

    // (num_terms, poly_index)
    fn optimize_outlined_lcs(
        polys: &mut Vec<SparsePolynomial<F, SparseTerm>>,
        mut lcs: Vec<(usize, usize)>,
    ) {
        lcs.sort_by_key(|(num_terms, _)| *num_terms);

        #[derive(PartialEq, Eq)]
        struct QueueItem<F: PrimeField>(usize, usize, SparsePolynomial<F, SparseTerm>);
        impl<F: PrimeField> PartialOrd for QueueItem<F> {
            fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
                Some(self.cmp(other))
            }
        }
        impl<F: PrimeField> Ord for QueueItem<F> {
            fn cmp(&self, other: &Self) -> std::cmp::Ordering {
                self.0.cmp(&other.0).reverse().then(self.1.cmp(&other.1))
            }
        }

        let mut lcs_queue = BTreeSet::new();
        let mut total_processed = 0;
        for (_, poly_index) in lcs.iter() {
            assert!(polys[*poly_index].terms.len() >= 2);
            let original_poly = polys[*poly_index].clone();
            for QueueItem(_, _, poly) in &lcs_queue {
                Self::try_optimize_lc(poly, &mut polys[*poly_index]);
            }
            lcs_queue.insert(QueueItem(
                original_poly.terms.len(),
                *poly_index,
                original_poly,
            ));
            total_processed += 1;
            if total_processed % 1000 == 0 {
                println!(
                    "Optimizing outlined LCs; total processed {}",
                    total_processed
                );
            }
        }
    }

    pub fn preprocess(r1cs: &R1CSFile<F>, config: ExpansionConfig) -> Self {
        let num_public_input = (r1cs.header.n_pub_in + r1cs.header.n_pub_out + 1) as usize;
        let mut witness = r1cs.witness.clone();

        let mut lcs = vec![];
        let mut constraint_polys = vec![];
        for (a, b, c) in &r1cs.constraints {
            // Heuristic
            let count_vars_a = a.iter().filter(|(var, _)| *var != 0).count();
            let count_vars_b = b.iter().filter(|(var, _)| *var != 0).count();
            let should_try_outline = count_vars_a >= 2 && count_vars_b >= 2;

            let should_outline_a = should_try_outline && count_vars_a >= 3;
            let should_outline_b = should_try_outline && count_vars_b >= 3;

            let mut maybe_outline_poly = |lc: &[(usize, F)], force_outline: bool| {
                let mut poly = Self::poly_from_lc(lc);
                if poly.terms.len() >= 6 || force_outline {
                    let num_terms = poly.terms.len();
                    poly.terms
                        .push((-F::one(), SparseTerm::new(vec![(witness.len(), 1)])));
                    constraint_polys.push(take(&mut poly));
                    poly = SparsePolynomial::from_coefficients_vec(
                        usize::MAX,
                        vec![(F::one(), SparseTerm::new(vec![(witness.len(), 1)]))],
                    );
                    witness.push(Self::evaluate_lc(lc, &witness));
                    lcs.push((num_terms, constraint_polys.len() - 1));
                }
                poly
            };

            let poly_a = maybe_outline_poly(a, should_outline_a);
            let poly_b = maybe_outline_poly(b, should_outline_b);
            let poly_c = maybe_outline_poly(c, false);
            constraint_polys.push(&naive_mul(&poly_a, &poly_b) - &poly_c);
        }
        println!("Outlined number constraints: {}", constraint_polys.len());
        println!(
            "Num terms before outlined LCs optimization: {}",
            constraint_polys
                .iter()
                .map(|x| x.terms.len())
                .sum::<usize>()
        );
        Self::optimize_outlined_lcs(&mut constraint_polys, lcs);

        println!(
            "Num terms: {}",
            constraint_polys
                .iter()
                .map(|x| x.terms.len())
                .sum::<usize>()
        );

        let mut dependencies_list = constraint_polys
            .par_iter()
            .map(|poly| Self::get_constraint_dependencies(num_public_input, poly))
            .collect::<Vec<_>>();

        let mut dependent_map: HashMap<usize, (usize, Vec<usize>)> = HashMap::new();
        let mut dependent_queue: BTreeSet<(Reverse<usize>, usize)> = BTreeSet::new();
        let mut queue: BinaryHeap<(Reverse<usize>, usize)> = BinaryHeap::new();
        for (i, (linear_terms, dependencies)) in dependencies_list.iter().enumerate() {
            for term in linear_terms.iter() {
                let (count, dependents) = dependent_map
                    .entry(*term)
                    .or_insert_with(|| (0, Vec::new()));
                *count += 1;
                dependents.push(i);
            }
            for (term, dependency_count) in dependencies.iter() {
                let (count, dependents) = dependent_map
                    .entry(*term)
                    .or_insert_with(|| (0, Vec::new()));
                *count += dependency_count;
                dependents.push(i);
            }
        }
        let maybe_enqueue = |queue: &mut BinaryHeap<(Reverse<usize>, usize)>,
                             dependent_map: &mut HashMap<usize, (usize, Vec<usize>)>,
                             i,
                             linear_terms: &BTreeSet<usize>,
                             dependencies: &BTreeMap<usize, usize>| {
            if dependencies.len() > 0 {
                return;
            }
            if linear_terms.len() == 0 {
                queue.push((Reverse(0), i));
            } else if linear_terms.len() == 1 {
                let var = linear_terms.first().unwrap();
                queue.push((
                    Reverse(dependent_map.get(var).map(|(count, _)| *count).unwrap_or(0)),
                    i,
                ));
            }
        };
        for (i, (linear_terms, dependencies)) in dependencies_list.iter().enumerate() {
            maybe_enqueue(
                &mut queue,
                &mut dependent_map,
                i,
                linear_terms,
                dependencies,
            );
        }
        for (idx, (count, _)) in &dependent_map {
            dependent_queue.insert((Reverse(*count), *idx));
        }

        let mut out_constraints = vec![];
        let mut processed_constraints = 0;
        let mut visited = vec![false; constraint_polys.len()];

        loop {
            while !queue.is_empty() {
                let (_, idx) = queue.pop().unwrap();
                if visited[idx] {
                    continue;
                }
                visited[idx] = true;
                processed_constraints += 1;

                if constraint_polys[idx].is_zero() {
                    continue;
                }

                let (linear_terms, _) = &mut dependencies_list[idx];
                if linear_terms.len() == 0 {
                    out_constraints.push(take(&mut constraint_polys[idx]));
                    continue;
                }

                let new_var = *linear_terms.first().unwrap();
                let dependents = dependent_map.remove(&new_var);
                let num_dependents = dependents.as_ref().map(|(count, _)| *count).unwrap_or(0);

                // It's generally not worth it to inline if there are more than one usage
                // since it must be repeated at each instance
                // Unless the substitution only has one term
                let should_inline = (num_dependents <= 2 || constraint_polys[idx].terms.len() == 2)
                    && config.check_poly(&constraint_polys[idx]);
                if !should_inline {
                    out_constraints.push(take(&mut constraint_polys[idx]));
                }

                debug_assert_eq!(linear_terms.len(), 1);
                dependents.map(|(count, dependents)| {
                    let removed = dependent_queue.remove(&(Reverse(count), new_var));
                    debug_assert!(removed);

                    if should_inline {
                        let subst =
                            Self::solve_for_variable(constraint_polys[idx].clone(), new_var);
                        let mut new_constraint_polys =
                            vec![SparsePolynomial::zero(); dependents.len()];
                        let is_inlined = dependents
                            .iter()
                            .zip(&mut new_constraint_polys)
                            .try_for_each(|(idx, out_poly)| {
                                if !config.check_poly(&constraint_polys[*idx]) {
                                    return None;
                                }
                                let new_poly = substitute(&constraint_polys[*idx], new_var, &subst);
                                if let Some(new_poly) = new_poly {
                                    if !config.check_poly(&new_poly) {
                                        return None;
                                    }

                                    *out_poly = new_poly;
                                    Some(())
                                } else {
                                    None
                                }
                            });
                        if is_inlined == None {
                            out_constraints.push(take(&mut constraint_polys[idx]));
                        } else {
                            for (idx, new_poly) in zip(&dependents, new_constraint_polys) {
                                constraint_polys[*idx] = new_poly;
                            }
                        }
                    }

                    for idx in &dependents {
                        if visited[*idx] {
                            continue;
                        }

                        let (linear_terms, dependencies) = &mut dependencies_list[*idx];
                        linear_terms.remove(&new_var);
                        dependencies.remove(&new_var);

                        maybe_enqueue(
                            &mut queue,
                            &mut dependent_map,
                            *idx,
                            linear_terms,
                            dependencies,
                        );
                    }
                });
            }

            if processed_constraints >= constraint_polys.len() {
                break;
            }

            // No more variables can be eliminated. We will name some variables free and continue
            while queue.is_empty() {
                let (_, var) = dependent_queue.pop_first().unwrap();

                for idx in dependent_map.remove(&var).unwrap().1 {
                    if visited[idx] {
                        continue;
                    }

                    let (linear_terms, dependencies) = &mut dependencies_list[idx];
                    linear_terms.remove(&var);
                    dependencies.remove(&var);

                    maybe_enqueue(
                        &mut queue,
                        &mut dependent_map,
                        idx,
                        linear_terms,
                        dependencies,
                    );
                }
            }
        }

        println!(
            "Num terms: {}",
            out_constraints.iter().map(|x| x.terms.len()).sum::<usize>()
        );

        out_constraints
            .par_iter_mut()
            .for_each(|poly| poly.num_vars = witness.len());

        Self {
            num_public_inputs: num_public_input,
            constraints: out_constraints,
            witness,
        }
    }

    pub fn is_satisfied(&self, values: &Vec<F>) -> bool {
        self.constraints
            .par_iter()
            .all(|poly| poly.evaluate(values) == F::zero())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bn254::Fr;
    use circom_compat::read_witness;
    use std::fs::File;
    use std::io::BufReader;

    #[test]
    fn test_circuit() {
        let reader = BufReader::new(File::open("D:/Projects/circuit.r1cs").unwrap());
        let mut file = R1CSFile::<Fr>::new(reader).unwrap();
        println!("R1CS num constraints: {}", file.header.n_constraints);

        let witness_reader = BufReader::new(File::open("D:/Projects/witness.json").unwrap());
        file.witness = read_witness::<Fr>(witness_reader);

        let result = ExpandedCircuit::<Fr>::preprocess(&file, ExpansionConfig::MaxCost(10));
        println!(
            "Expanded circuit num constraints: {}",
            result.constraints.len()
        );
        assert!(result.is_satisfied(&result.witness));
    }
}

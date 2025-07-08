use clap::Parser;
use circom_compat::{read_witness, R1CSFile};
use std::{fs::File, io::BufReader, time::Instant};
use ark_bn254::Fr;
use hyperplonk::witness::WitnessColumn;
use plonkify::{Plonkifier, GeneralPlonkifer};
use subroutines::PolynomialCommitmentScheme;
use plonkify::{
    CustomizedGates,
    general::{
        NaiveLinearOnlyGeneralPlonkifier, LinearOnlyGeneralPlonkifier, SimpleGeneralPlonkifier,
    },
    vanilla::{GreedyBruteForcePlonkifier, OptimizedPlonkifier, SimplePlonkifer},
};
use subroutines::{
    pcs::prelude::{MultilinearKzgPCS},
    poly_iop::PolyIOP,
};
use ark_std::test_rng;
use hyperplonk::structs::HyperPlonkIndex;
use hyperplonk::HyperPlonkSNARK;
use ark_std::Zero;
use plonkify::circuit_utils::{
    pad_permutation_field,
    check_permutation,
    convert_selectors,
    convert_params,
    split_flat_witness,
    flatten_witness_matrix,
};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    /// Optimization level (0: naive, 1: optimized, 2: brute-force)
    #[arg(short = 'O', default_value_t = 1, value_parser = clap::value_parser!(u8).range(..3))]
    optimize: u8,
    /// Whether to use jellyfish turboplonk gates
    #[arg(long)]
    general: bool,
    /// R1CS circuit file (e.g. circuit.r1cs)
    circuit: String,
    /// JSON witness file (e.g. witness.json)
    witness: String,
}

fn main() {
    let Cli { optimize, general, circuit, witness } = Cli::parse();
    let mut file = R1CSFile::<Fr>::new(BufReader::new(File::open(circuit).unwrap())).unwrap();
    file.witness = read_witness::<Fr>(BufReader::new(File::open(witness).unwrap()));

    println!("R1CS: constraints={}, public={}, private={}, witness_len={} ",
        file.header.n_constraints,
        file.header.n_pub_in,
        file.header.n_prv_in,
        file.witness.len()
    );

    let overall_start = Instant::now();
    if general {
        let (circuit, wit) = match optimize {
            0 => NaiveLinearOnlyGeneralPlonkifier::plonkify(
                &file,
                &CustomizedGates::jellyfish_turbo_plonk_gate(),
            ),
            1 => LinearOnlyGeneralPlonkifier::plonkify(
                &file,
                &CustomizedGates::jellyfish_turbo_plonk_gate(),
            ),
            2 => SimpleGeneralPlonkifier::plonkify(
                &file,
                &CustomizedGates::jellyfish_turbo_plonk_gate(),
            ),
            _ => unreachable!(),
        };
        println!("Plonk constraints: {}", circuit.params.num_constraints);
        assert!(circuit.is_satisfied(&wit));
    } else {
        let (mut plonk_circ, plonk_wit) = match optimize {
            0 => SimplePlonkifer::<Fr>::plonkify(&file),
            1 => OptimizedPlonkifier::<Fr>::plonkify(&file),
            2 => GreedyBruteForcePlonkifier::<Fr>::plonkify(&file),
            _ => unreachable!(),
        };

        println!("Plonk constraints: {}", plonk_circ.params.num_constraints);
        assert!(plonk_circ.is_satisfied(&plonk_wit));

        let num_rows = plonk_circ.params.num_constraints;
        let num_cols = plonk_circ.params.gate_func.num_witness_columns();
        let num_pub = plonk_circ.params.num_pub_input;

        let witness_cols: Vec<_> = split_flat_witness(&plonk_wit, num_cols, num_rows, num_pub)
            .into_iter()
            .map(WitnessColumn::new)
            .collect();
        let flat_witness = flatten_witness_matrix(
            &witness_cols.iter().map(|w| w.coeff_ref().to_vec()).collect::<Vec<_>>(),
        );

        // Pad constraints and public inputs to power-of-two
        plonk_circ.params.num_constraints = plonk_circ.params.num_constraints.next_power_of_two();
        plonk_circ.params.num_pub_input = plonk_circ.params.num_pub_input.next_power_of_two();

        let pub_pad = num_pub.next_power_of_two() - num_pub;
        let new_perm = pad_permutation_field(
            plonk_circ.permutation.clone(),
            num_rows,
            pub_pad,
            num_cols * plonk_circ.params.num_constraints,
        );

        assert!(check_permutation(&plonk_wit, &plonk_circ.permutation, num_rows));
        assert!(check_permutation(&flat_witness, &new_perm, plonk_circ.params.num_constraints));

        let selectors = convert_selectors(plonk_circ.selectors.clone());
        let circuit = HyperPlonkIndex {
            params: convert_params(plonk_circ.params.clone()),
            permutation: new_perm,
            selectors,
        };

        // SRS and SNARK
        let mut rng = test_rng();
        let srs = MultilinearKzgPCS::<ark_bn254::Bn254>::gen_srs_for_testing(&mut rng, 20).unwrap();
        let mut pub_inputs = plonk_wit[..num_pub].to_vec();
        pub_inputs.resize(num_pub.next_power_of_two(), Fr::zero());

        let (pk, vk) = <PolyIOP<Fr> as HyperPlonkSNARK<ark_bn254::Bn254,
            MultilinearKzgPCS<ark_bn254::Bn254>>>::preprocess(&circuit, &srs)
            .unwrap();
        println!("Key extraction: {:?}", overall_start.elapsed());

        let prove_start = Instant::now();
        let proof = <PolyIOP<Fr> as HyperPlonkSNARK<ark_bn254::Bn254,
            MultilinearKzgPCS<ark_bn254::Bn254>>>::prove(&pk, &pub_inputs, &witness_cols)
            .unwrap();
        println!("Proving: {:?}", prove_start.elapsed());

        let verify_start = Instant::now();
        assert!(<PolyIOP<Fr> as HyperPlonkSNARK<ark_bn254::Bn254,
            MultilinearKzgPCS<ark_bn254::Bn254>>>::verify(&vk, &pub_inputs, &proof)
            .unwrap());
        println!("Verifying: {:?}", verify_start.elapsed());
    }

    println!("Total time: {:?}", overall_start.elapsed());
}

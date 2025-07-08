use ark_bn254::Fr;
use circom_compat::{read_witness, read_binary_wtns, R1CSFile};
use clap::Parser;
use plonkify::{
    general::{
        ExpandedCircuit, ExpansionConfig, LinearOnlyGeneralPlonkifier,
        NaiveLinearOnlyGeneralPlonkifier, SimpleGeneralPlonkifier,
    },
    vanilla::{GreedyBruteForcePlonkifier, OptimizedPlonkifier, SimplePlonkifer},
    CustomizedGates, GeneralPlonkifer, Plonkifier,
};
use std::io::BufReader;
use std::{fs::File, time::Instant};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    /// Optimization level
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
    let cli = Cli::parse();

    let reader = BufReader::new(File::open(cli.circuit).unwrap());
    let mut file = R1CSFile::<Fr>::new(reader).unwrap();

    let is_json_witness = cli.witness.to_ascii_uppercase().ends_with(".JSON");
    let witness_reader = BufReader::new(File::open(cli.witness).unwrap());
    
    file.witness = if is_json_witness {
        read_witness::<Fr>(witness_reader)
    } else {
        read_binary_wtns::<Fr>(witness_reader).unwrap()
    };

    println!("R1CS num constraints: {}", file.header.n_constraints);

    // let (plonkish_circuit, plonkish_witness) = SimpleGeneralPlonkifier::<Fr>::plonkify(
    //     &file,
    //     &CustomizedGates::jellyfish_turbo_plonk_gate(),
    // );
    // return;

    // let (plonkish_circuit, plonkish_witness) = LinearOnlyGeneralPlonkifier::<Fr>::plonkify(
    //     &file,
    //     &CustomizedGates::jellyfish_turbo_plonk_gate(),
    // );
    // // return;

    let start = Instant::now();
    for i in 0..5 {
        if cli.general {
            let (plonkish_circuit, plonkish_witness) = match cli.optimize {
                0 => NaiveLinearOnlyGeneralPlonkifier::<Fr>::plonkify(
                    &file,
                    &CustomizedGates::jellyfish_turbo_plonk_gate(),
                ),
                1 => LinearOnlyGeneralPlonkifier::<Fr>::plonkify(
                    &file,
                    &CustomizedGates::jellyfish_turbo_plonk_gate(),
                ),
                2 => SimpleGeneralPlonkifier::<Fr>::plonkify(
                    &file,
                    &CustomizedGates::jellyfish_turbo_plonk_gate(),
                ),
                _ => panic!("Unexpected optimizization level"),
            };
            println!(
                "Plonk num constraints: {}",
                plonkish_circuit.params.num_constraints
            );
        } else {
            let (plonkish_circuit, plonkish_witness) = match cli.optimize {
                0 => SimplePlonkifer::<Fr>::plonkify(&file),
                1 => OptimizedPlonkifier::<Fr>::plonkify(&file),
                2 => GreedyBruteForcePlonkifier::<Fr>::plonkify(&file),
                _ => panic!("Unexpected optimizization level"),
            };
            println!(
                "Plonk num constraints: {}",
                plonkish_circuit.params.num_constraints
            );
        }
    }
    
    let end = Instant::now();
    println!("Time: {}", (end - start).as_micros() / 5);
}

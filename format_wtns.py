import json

def format_json_array(input_file, output_file=None):
    # Read the JSON array from file
    with open(input_file, 'r') as f:
        data = json.load(f)

    # Check it's a list
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a top-level array.")

    # Format into desired pretty format
    formatted = "[\n " + ("\n,".join(f'"{value}"' for value in data)) + "\n]"

    if output_file:
        with open(output_file, 'w') as f:
            f.write(formatted)
    else:
        print(formatted)

# Example usage
format_json_array("witness.json", output_file="formatted_witness.json")
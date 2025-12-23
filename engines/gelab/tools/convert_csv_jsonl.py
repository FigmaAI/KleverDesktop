import sys
import io
import pandas as pd
import jsonlines
import json
from tqdm import tqdm

# to convert a csv file to jsonlines
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python csv_to_jsonlines.py input.csv output.jsonl")
        sys.exit(1)

    input_csv = sys.argv[1]
    output_jsonl = sys.argv[2]

    df = pd.read_csv(input_csv)
    with jsonlines.open(output_jsonl, mode='w') as writer:
        for record in tqdm(df.to_dict(orient='records')):
            if "json_data" in record:
                record["json_data"] = json.loads(record["json_data"])
            writer.write(record)

    print(f"Converted {input_csv} to {output_jsonl}")
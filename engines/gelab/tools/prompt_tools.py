import json

def extra_json_from_model_output(model_output):
    """
    Extracts extra JSON data from the model output.

    Args:
        model_output (str): The output from the model, expected to be a JSON string.

    Returns:
        dict: A dictionary containing the extracted extra JSON data.
    """
    # try:
        # Attempt to parse the model output as JSON
        # extra_json = json.loads(model_output)
    json_str = model_output.split("```json")[1].split("```")[0]
    json_str_lines = json_str.split("\n")
    for i in range(len(json_str_lines)):
        if '''//''' in json_str_lines[i]:
            json_str_lines[i] = json_str_lines[i].split("//")[0]
    
    json_str = "\n".join(json_str_lines)
    extra_json = json.loads(json_str)
    return extra_json
    # except json.JSONDecodeError:
        # If parsing fails, return an empty dictionary
        # return {}

def messages2sft(messages):
    """
    Converts a list of messages into a structured SFT (Supervised Fine-Tuning) format.

    Args:
        messages (list): A list of message dictionaries, each containing 'role' and 'content'.

    Returns:
        dict: A dictionary representing the SFT format.
    """
    user_role = ['user', "human"]
    gpt_role = ['assistant', "gpt"]

    conversations = []
    images = []
    for message in messages:
        content = message['content']

        content_str_list = []

        if isinstance(content, list):
            for c in content:
                if c['type'] == 'text':
                    assert "<image>" not in c['text'], f"{c['text']} \n\nText should not contain <image> tag here!"
                    content_str_list.append(c['text'])

                elif c['type'] == 'image_url':
                    content_str_list.append("<image>")
                    images.append(c['image_url']['url'])
                    
                else:
                    raise ValueError(f"Unknown content type: {c['type']} in message {message}")
        else:
            assert "<image>" not in content, f"{content} \n\nText should not contain <image> tag here!"
            content_str_list.append(content)

        content_str = "".join(content_str_list)

        current_role = message['role'].lower()
        if current_role in user_role:
            role = "human"
        elif current_role in gpt_role:
            role = "assistant"

        conversations.append({
            "role": role,
            "content": content_str
        })
    
    sft = {
        "conversations": conversations,
        "images": images
    }

    return sft
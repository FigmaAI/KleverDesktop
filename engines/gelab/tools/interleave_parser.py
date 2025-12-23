import json



def try_pause_json(answer_str, image_list):
    answer_interleaves =[]
    answer_strs = answer_str.split("\n")
    for answer in answer_strs:
        if len(answer) == 0:
            answer_interleaves.append({
                "type": "text",
                "text": "\n"
            })
        else:
            if "{" in answer and "}" in answer:
                try:
                    json_str = answer.split("{")[-1].split("}")[0]
                    json_str = "{" + json_str + "}"
                    # answer_interleaves.append(json.loads(json_str))
                    json_dict = json.loads(json_str)
                    
                    if "imageRef"  in json_dict:
                        idx_str = json_dict['imageRef']
                    else:
                        idx_str = json_dict['ref']
                    
                    # if idx_str == "None":
                        # continue

                    idx = int(idx_str.split("<---")[-1].split("--->")[0]) -1 
                    title = json_dict.get("title")

                    print("PARSE idx", idx, answer)
                    answer_interleaves.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image_list[idx]
                        }
                    })
                    answer_interleaves.append({
                        "type": "text",
                        "text": "\n"+answer+"\n"
                    })


                except Exception as e:
                    print(e.args)
                    answer_interleaves.append({
                        "type": "text",
                        "text": answer
                    })
            else:
                answer_interleaves.append({
                    "type": "text",
                    "text": answer
                })
    return answer_interleaves


def get_image_list_from_messages(messages):
    image_list = []
    for msg in messages:
        if type(msg['content']) == str:
            continue
        assert type(msg['content']) == list
        for c in msg['content']:
            if c['type'] == "image_url" and c['image_url']['url'] is None:
                continue
            elif c['type'] is None:
                continue
            else:
                if c['type'] == "image_url":
                    image_list.append(c['image_url']['url'])
    print(f"CHECK IMAGE LIST length = {len(image_list)}")
    return image_list

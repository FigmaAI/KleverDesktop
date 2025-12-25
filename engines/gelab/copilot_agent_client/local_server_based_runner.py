from multiprocessing import Process, Queue

from copilot_front_end.mobile_action_helper import list_devices, get_device_wm_size

from megfile import smart_open, smart_exists
from copy import deepcopy
import jsonlines

from copilot_agent_client.pu_client import evaluate_task_on_device

import time
import random


class CopilotClientRolloutRunner:
    def __init__(self,
                 device_task_map:dict, 
                 server,
                 rollout_config: dict,
                 result_output_file: str,
                 logger=None, device_name_map = {}
                 ):
        
        self.device_task_map = device_task_map

        self.device_count = len(device_task_map)

        self.server = server
        self.rollout_config = rollout_config

        self.result_output_file = result_output_file

        self.logger = logger

        self.device_name_map = device_name_map
        self.device_task_count_map = {}
        
        # queue for tasks
        self.task_queue = {}
        for device_id in device_task_map:
            self.task_queue[device_id] = Queue()

        self.done_queue = Queue()

        self.log_queue = Queue()

    
    def logger_runner(self):
        
        stop_count = 0
        while True:
            log_item = self.log_queue.get()
            if log_item is None:
                stop_count += 1
                if stop_count >= self.device_count:
                    break
                else:
                    continue
            
            if self.logger is not None:
                self.logger.log_str(log_item, is_print=False)
            
        print("Logger runner stopped.")

    def reader_runner(self):
        
        self.log_queue.put(f"Start reader runner.")

        def key_func(task, model_name):
            return f"{task}__{model_name}"
        
        def get_model_name(rollout_config):
            if 'model_config' in rollout_config and 'model_name' in rollout_config['model_config']:
                return rollout_config['model_config']['model_name']
            else:
                return "unknown_model"
        
        exist_task_set = set()

        if smart_exists(self.result_output_file):
            with smart_open(self.result_output_file, 'r') as f:
                reader = jsonlines.Reader(f)
                for obj in reader:
                    task = obj['task']
                    model_name = get_model_name(obj['rollout_config'])
                    exist_task_set.add(key_func(task, model_name))

        self.log_queue.put(f"Existing {len(exist_task_set)} tasks in the result file.")

        task_put_count = 0

        for device_id in self.device_task_map:
            device_name = self.device_name_map.get(device_id, "UNKNOWN_DEVICE")
            tasks = self.device_task_map[device_id]
            random.shuffle(tasks)

            device_put_count = 0

            for task_meta in tasks:

                task = task_meta['task']
                model_name = get_model_name(self.rollout_config)
                if key_func(task, model_name) in exist_task_set:
                    # self.log_queue.put(f"Skip existing task {task} with model {model_name} on device {device_id} ({device_name})")
                    continue


                task_put_count += 1
                device_put_count += 1
                self.task_queue[device_id].put(task_meta)

            self.device_task_count_map[device_id] = device_put_count
            self.log_queue.put(f"Device {device_id} ({device_name}) has {len(tasks)} tasks, put {device_put_count} tasks into the queue.")


        self.log_queue.put(f"Total put {task_put_count} tasks into the queues.")
        self.log_queue.put(f"Reader runner stopped.")
        
    def work_runner(self, device_id):

        device_name = self.device_name_map.get(device_id, "UNKNOWN_DEVICE")
        total_task_count = 0
        success_task_count = 0
        error_task_count = 0

        def total_task_count_func():
            total_taskcount = 0
            for device_id in self.device_task_count_map:
                # total_taskcount += self.task_queue_map[device_id].qsize()
                total_taskcount += self.device_task_count_map[device_id]
            return total_taskcount
        
        device_info = {
            "device_id": device_id,
            "device_wm_size": get_device_wm_size(device_id)
        }

        while not self.task_queue[device_id].empty():
            task_meta = self.task_queue[device_id].get()

            task = task_meta['task']

            total_task_count += 1

            self.device_task_count_map[device_id] -= 1

            self.log_queue.put(f"Device {device_id} ({device_name}) start task {task}. Remaining tasks in queue: {self.device_task_count_map[device_id]}. Total remaining tasks: {total_task_count_func()}")
            
            total_taskcount = total_task_count_func()
            print(f"Number of tasks currently in the queue: {total_taskcount}")

            try:

                result_log = evaluate_task_on_device(
                    self.server,
                    device_info,
                    task,
                    self.rollout_config,
                    extra_info = task_meta.get('origin_meta_data', {})
                )

                result_log['device_name'] = device_name

                result_log['origin_meta_data'] = task_meta.get('origin_meta_data', {})

                self.done_queue.put(result_log)
                success_task_count += 1
                self.log_queue.put(f"Device {device_id} ({device_name}) finished task {task}. Success tasks: {success_task_count}, Error tasks: {error_task_count}.")
            
            except Exception as e:
                error_task_count += 1
                
                self.device_task_count_map[device_id] += 1

                # to put the task back to the queue
                self.task_queue[device_id].put(task_meta)

                self.log_queue.put(f"Device {device_id} ({device_name}) error on task {task}: {e}. Success tasks: {success_task_count}, Error tasks: {error_task_count}.")
                continue

        self.log_queue.put(f"Device {device_id} ({device_name}) all tasks done. Total tasks: {total_task_count}, Success tasks: {success_task_count}, Error tasks: {error_task_count}.")
        self.log_queue.put(None)

        self.done_queue.put(None)

    def writer_runner(self):
        """
        This function collects logs from the done queue and writes them to the output log file.
        It runs until it receives a None signal indicating all tasks are processed.
        """
        stop_signal_count = 0
        log_writer_count = 0
        while True:
            log = self.done_queue.get()
            if log is None:
                stop_signal_count += 1
                if stop_signal_count == len(self.device_task_map):
                    break
                continue
            
            # Write the log to the output file
            with smart_open(self.result_output_file, 'a', encoding='utf-8') as f:
                log_writer = jsonlines.Writer(f)
                log_writer.write(log)
                log_writer_count += 1
            
        print(f"All logs have been written to {self.result_output_file}. Total logs written: {log_writer_count}")


    def run(self):

        workers = []
        # Start the logger process
        logger = Process(target=self.logger_runner)
        logger.start()
        workers.append(logger)


        # Start the reader process to populate task queues
        self.reader_runner()
        
        for device_id in self.device_task_map:
            worker = Process(target=self.work_runner, args=(device_id,))
            workers.append(worker)
            worker.start()
        
        writer = Process(target=self.writer_runner)
        writer.start()

        for worker in workers:
            worker.join()

        writer.join()
        print("All tasks have been processed and logs written to the output file.")



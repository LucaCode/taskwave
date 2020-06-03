import TaskWorkerPool from "./taskWorkerPool";
import {PromiseValue} from "./promiseValue";

export interface Task<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): Promise<PromiseValue<ReturnType<T>>>;
    destroy(): void;
}

export function task<T extends (...args: any[]) => any>(executer: T, poolSize: number = 8, createTempWorker: boolean = false): Task<T> {
    const pool = new TaskWorkerPool(executer, false, poolSize, createTempWorker);
    return pool.getTask();
}

export function preparedTask<T extends (...args: any[]) => any>(executerCreator: () => T, poolSize: number = 8, createTempWorker: boolean = false): Task<T> {
    const pool = new TaskWorkerPool(executerCreator, true, poolSize, createTempWorker);
    return pool.getTask();
}
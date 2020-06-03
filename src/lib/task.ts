import TaskWorkerPool from "./taskWorkerPool";
import {PromiseValue} from "./promiseValue";

export interface Task<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): Promise<PromiseValue<ReturnType<T>>>;
    destroy(): void;
}

export function task<T extends (...args: any[]) => any>(executor: T, poolSize: number = 8, createTempWorker: boolean = false): Task<T> {
    const pool = new TaskWorkerPool(executor, undefined, poolSize, createTempWorker);
    return pool.getTask();
}

export function preparedTask<T extends (...args: any[]) => any,I extends (...args: any[]) => T | Promise<T>>(executorCreator: I, poolSize: number = 8, createTempWorker: boolean = false): (...args: Parameters<I>) => Task<T> {
    return (...args) => {
        const pool = new TaskWorkerPool<T>(executorCreator as any, args, poolSize, createTempWorker);
        return pool.getTask();
    }
}
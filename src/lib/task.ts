import TaskWorkerPool from "./taskWorkerPool";
import {PromiseValue} from "./promiseValue";

export interface Task<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): Promise<PromiseValue<ReturnType<T>>>;
    destroy(): void;
}

/**
 * This function can be used to create a task that doesn't need to prepare.
 * Later on, you can execute the task multiple times and the execution will happen on another thread
 * to not block the current thread and allow multithreading.
 * Notice that the execution process will happen asynchronously.
 * @param task
 * The task function, for example, could be some heavy CPU calculations.
 * In the task function, you can not refer to variables of an outer scope.
 * Because the function gets executed on a completely different thread with another context.
 * The task function can accept parameters but all parameter types must be JSON friendly types.
 * The same rule also applies to the return value of the task function.
 * The task can also be an asynchronous function.
 * @param poolSize
 * The pool size indicates how many threads (workers) should be created.
 * Every worker can process the task only once at the same time but will be reused.
 * @default: 8
 * @param createTempWorker
 * Defines what should be done when all workers from the pool are busy.
 * It indicates if a new temporary worker should be created to process the task and
 * will be destroyed afterwards.
 * If the option is false taskwave will append the planned task execution to a queue.
 * When a worker from the pool gets available it will execute a planned task execution
 * from the queue when the queue is not empty.
 * @default: false
 * @example
 * const calculateAB = task((a: number, b: number) => {
 *     return a + b;
 * });
 * //The calculation will happen on another thread.
 * const result await = calculateAB(10,10);
 * //result = 20
 */
export function task<T extends (...args: any[]) => any>(task: T, poolSize: number = 8, createTempWorker: boolean = false): Task<T> {
    const pool = new TaskWorkerPool(task, undefined, poolSize, createTempWorker);
    return pool.getTask();
}

/**
 * This function can be used to create a prepared task.
 * The preparation of the task can be used to initialize values,
 * pass in values or to require node modules.
 * The preparation function will only be executed once in the creation of the worker.
 * Later on, you can execute the prepared task multiple times and the execution will
 * happen on another thread to not block the current thread and allow multithreading.
 * Notice that the execution process will happen asynchronously.
 * @param taskCreator
 * This function must return the task and represents the preparation of the task.
 * It will only be executed once at the creation of the worker.
 * Parameters can be passed into this function but all parameter types must be JSON friendly types.
 * This function also can be asynchronous.
 * The returned task function, for example, could be some heavy CPU calculations.
 * In the task function, you can not refer to variables of an outer
 * scope than the preparation function.
 * Because both functions get executed on a completely different thread with another context.
 * The task function can accept parameters but all parameter types must be JSON friendly types.
 * The same rule also applies to the return value of the task function.
 * The task can also be an asynchronous function.
 * @param poolSize
 * The pool size indicates how many threads (workers) should be created.
 * Every worker can process the task only once at the same time but will be reused.
 * @default: 8
 * @param createTempWorker
 * Defines what should be done when all workers from the pool are busy.
 * It indicates if a new temporary worker should be created to process the task and
 * will be destroyed afterwards.
 * If the option is false taskwave will append the planned task execution to a queue.
 * When a worker from the pool gets available it will execute a planned task execution
 * from the queue when the queue is not empty.
 * @default: false
 * @example
 * const calculateABC = preparedTask((a: number, b: number) => {
 *     //prepare ab
 *     const ab = a + b;
 *     return (c: number) => {
 *         return ab + c;
 *     }
 * })(10,15);
 * //The calculation will happen on another thread.
 * const result await = calculateABC(10);
 * //result = 35
 */
export function preparedTask<T extends (...args: any[]) => any,I extends (...args: any[]) => T | Promise<T>>(taskCreator: I, poolSize: number = 8, createTempWorker: boolean = false): (...args: Parameters<I>) => Task<T> {
    return (...args) => {
        const pool = new TaskWorkerPool<T>(taskCreator as any, args, poolSize, createTempWorker);
        return pool.getTask();
    }
}
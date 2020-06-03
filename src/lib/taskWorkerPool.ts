import {PromiseValue} from "./promiseValue";
import Worker from './worker';
import {Task} from "./task";

export default class TaskWorkerPool<T extends (...args: any[]) => any> {

    private empty: boolean;

    private readonly script: string;

    private workers: Worker<T>[] = [];
    private workersLength: number = 0;

    private _waitForWorker: ([(worker: Worker<T>) => void,(err: any) => void])[] = [];

    constructor(scriptFunction: T, preparedArgs: any[] | undefined, private poolSize: number, private createTempWorker: boolean) {
        const script = Worker.createScript(scriptFunction,preparedArgs);
        this.script = script;

        for(let i = 0; i < poolSize; i++){
            this.workers[i] = new Worker<T>(script);
            this.workers[i].setFreeListener(() => this.freeWorker(this.workers[i]));
        }
        this.empty = poolSize <= 0;
        this.workersLength = poolSize;
    }

    private freeWorker(worker: Worker<T>) {
        if(this._waitForWorker.length > 0){
            this._waitForWorker.pop()![0](worker);
        }
    }

    private waitForWorker(): Promise<Worker<T>> {
        if(this.empty) throw new Error('Pool is empty.');
        return new Promise((resolve, reject) => {
            this._waitForWorker.push([resolve,reject]);
        })
    }

    async run(...args: Parameters<T>): Promise<PromiseValue<ReturnType<T>>> {
        let worker: Worker<T> | undefined;
        let tmpWorker;
        for(let i = 0; i < this.workersLength; i++){
            if(this.workers[i].canBeUsed()) {
                worker = this.workers[i];
                break;
            }
        }
        if(worker === undefined){
            if(this.createTempWorker){
                worker = new Worker(this.script);
                await worker.waitForReady();
                tmpWorker = true;
            }
            else {
                worker = await this.waitForWorker();
            }
        }
        const res = await worker.run(...args);
        if(tmpWorker) worker.destroy();
        return res;
    }

    destroy() {
        for(let i = 0; i < this.workersLength; i++){
            this.workers[i].destroy();
        }
        this.workers = [];
        this.workersLength = 0;
        this.empty = true;
        for(let i = 0; i < this._waitForWorker.length; i++){
            this._waitForWorker[i][1](new Error('Pool destroyed.'));
        }
        this._waitForWorker = [];
    }

    getTask(): Task<T> {
        const func = this.run.bind(this as any);
        (func as unknown as Task<any>).destroy = () => this.destroy();
        return func as unknown as Task<T>;
    }
}
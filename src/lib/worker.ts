import {PromiseValue} from "./promiseValue";

const windowNotDefined = typeof window === 'undefined';

let NodeWorker;
if(windowNotDefined) {
    NodeWorker = require('worker_threads').Worker;
}

export const enum MessageEvent {
    WorkerReady,
    Result,
    Error
}

export default class Worker<T extends (...args: any[]) => any> {

    private destroyed: boolean = false;

    private readyPromise: Promise<void>;
    private _resolveReady: () => void;
    private ready: boolean = false;

    private process: Promise<PromiseValue<ReturnType<T>>> | undefined;
    private _resolveProcess: ((result: PromiseValue<ReturnType<T>>) => void) | undefined;
    private _rejectProcess: ((err: any) => void) | undefined;

    private freeListener: () => void = () => {};
    private readonly destroyWorker: () => void;
    private readonly sendToWorker: (...args: Parameters<T>) => void;

    constructor(script: string) {
        this.readyPromise = new Promise<void>(resolve => {this._resolveReady = resolve});
        if (windowNotDefined) {
            const worker = new NodeWorker(script, { eval: true });
            worker.on('message', ([event, data]) => this.onMessage(event,data));
            worker.on('error', (err) => this.rejectProcess(err));
            this.destroyWorker = () => worker.terminate();
            this.sendToWorker = (...args) => worker.postMessage(args);
        } else {
            const worker = new window.Worker(
                window.URL.createObjectURL(new window.Blob([script], { type: 'application/js' }))
            );
            worker.onmessage = (e) => this.onMessage(e.data[0],e.data[1]);
            worker.onerror = (err) => this.rejectProcess(err);
            worker.onmessageerror = (err) => this.rejectProcess(err);
            this.destroyWorker = () => worker.terminate();
            this.sendToWorker = (...args) => worker.postMessage(args);
        }
    }

    private onMessage(event: MessageEvent, data: any) {
        switch (event) {
            case MessageEvent.Result:
                this.resolveProcess(data);
                break;
            case MessageEvent.Error:
                this.rejectProcess(data)
                break;
            case MessageEvent.WorkerReady:
                if(!this.ready){
                    this.isReady();
                }
                break;
        }
    }

    public waitForReady(): Promise<void> {
        return this.readyPromise;
    }

    private isReady() {
        this.ready = true;
        this._resolveReady();
        this.freeListener();
    }

    private resolveProcess(res: any) {
        if(this._resolveProcess) {
            this._resolveProcess(res);
            this.doneProcess();
        }
    }

    private rejectProcess(err: any) {
        if(this._rejectProcess) {
            this._rejectProcess(err);
            this.doneProcess();
        }
    }

    private static createScriptTask(process: (...args: any[]) => any, preparedTask: boolean) {
        if(preparedTask){
            return `const _task = (${process.toString()})();` +
                `const task = (async (...args) => _task(...args));`
        }
        return `const task = (async (...args) => (${process.toString()})(...args));`
    }

    static createScript(process: (...args: any[]) => any, preparedTask: boolean): string {
        if(windowNotDefined) {
            return "const parentPort = require('worker_threads').parentPort;" +
                Worker.createScriptTask(process,preparedTask) +
                "parentPort.on('message',(args) => task(...args).then(r => parentPort.postMessage([1,r])).catch(err => parentPort.postMessage([2,err])));" +
                "parentPort.postMessage([0])";
        }
        else {
            return Worker.createScriptTask(process,preparedTask) +
                "onmessage = (e) => task(...e.data).then(r => postMessage([1,r])).catch(err => postMessage([2,err]));" +
                "parentPort.postMessage([0])";
        }
    }

    private doneProcess() {
        this.process = undefined;
        this._resolveProcess = undefined;
        this._rejectProcess = undefined;
        this.freeListener();
    }

    private createProcess(): Promise<PromiseValue<ReturnType<T>>> {
        this.process = new Promise((resolve,reject) => {
            this._resolveProcess = resolve;
            this._rejectProcess = reject;
        });
        return this.process;
    }

    setFreeListener(listener: () => void) {
        if(this.destroyed) throw new Error('Worker destroyed.');
        this.freeListener = listener;
    }

    canBeUsed(): boolean {
        return !!this.process && this.ready;
    }

    destroy() {
        if(this._rejectProcess){
            this._rejectProcess(new Error('Worker destroyed.'));
        }
        this.doneProcess();
        this.freeListener = () => {};
        this.destroyWorker();
        this.destroyed = true;
    }

    run(...args: Parameters<T>): Promise<PromiseValue<ReturnType<T>>> {
        if(this.destroyed) throw new Error('Worker destroyed.');
        if(!this.ready) throw new Error('Worker is not ready.');
        if(!this.process){
            const process = this.createProcess();
            this.sendToWorker(...args);
            return process;
        }
        else {throw new Error('Worker is already in use.');}
    }
}
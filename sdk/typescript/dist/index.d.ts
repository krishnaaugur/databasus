export * from './types';
export * from './client';
export * from './ui/widget';
export * from './ui/mount';
import './ui/custom-element';
import { DatabasusClient } from './client';
import { mount } from './ui/mount';
export declare const Databasus: {
    Client: typeof DatabasusClient;
    mount: typeof mount;
};
export default Databasus;

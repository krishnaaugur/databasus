export * from './types';
export * from './client';
export * from './ui/widget';
export * from './ui/mount';
import './ui/custom-element';

import { DatabasusClient } from './client';
import { mount } from './ui/mount';

export const Databasus = {
  Client: DatabasusClient,
  mount,
};

export default Databasus;

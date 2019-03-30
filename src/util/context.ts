
import debuglog from 'debug';
import { IGraphQLComponent, IContextConfig, ContextFunction, IContextMiddleware, IContextWrapper } from '../typedefs';

const debug = debuglog('graphql-component:context');

export const contextBuilder = function (component: IGraphQLComponent, ctxConfig?: IContextConfig): ContextFunction {
  return async function (arg) {
    const ctx = {};

    for (const imp of component.imports) {
      Object.assign(ctx, await imp.context(arg));
    }

    if (ctxConfig) {
      debug(`building ${ctxConfig.namespace} context`);

      if (!ctx[ctxConfig.namespace]) {
        ctx[ctxConfig.namespace] = {};
      }

      Object.assign(ctx[ctxConfig.namespace], await ctxConfig.factory.call(component, arg)); 
    }

    return ctx;
  };
};

export const createContext = function (context: ContextFunction): IContextWrapper {
  const middleware: IContextMiddleware[] = [];

  const creator = async function (arg) {
    debug('building root context');

    for (let { name, fn } of middleware) {
      debug(`applying ${name} middleware`);
      arg = await fn(arg);
    }

    const ctx = await context(arg);

    return {
      ...arg,
      ...ctx
    };
  };

  creator.use = function (name: string|ContextFunction|null, fn?: ContextFunction|string): void {
    if (typeof name === 'function') {
      fn = name;
      name = 'unknown';
    }
    debug(`adding ${name} middleware`);
    middleware.push({ name, fn: <ContextFunction>fn });
  };

  return creator;
};
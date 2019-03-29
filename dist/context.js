"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default('graphql-component:context');
exports.builder = function (component, ctxConfig) {
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
exports.create = function (context) {
    const middleware = [];
    const createContext = async (arg) => {
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
    createContext.use = (name, fn) => {
        if (typeof name === 'function') {
            fn = name;
            name = 'unknown';
        }
        debug(`adding ${name} middleware`);
        middleware.push({ name, fn });
    };
    return createContext;
};
exports.default = { builder: exports.builder, create: exports.create };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0Esa0RBQTZCO0FBRzdCLE1BQU0sS0FBSyxHQUFHLGVBQVEsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBRXZDLFFBQUEsT0FBTyxHQUFHLFVBQVUsU0FBNEIsRUFBRSxTQUEwQjtJQUN2RixPQUFPLEtBQUssV0FBVyxHQUFHO1FBQ3hCLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUVmLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRTtZQUNuQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUM1QztRQUVELElBQUksU0FBUyxFQUFFO1lBQ2IsS0FBSyxDQUFDLFlBQVksU0FBUyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUM7WUFFakQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQzdCLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO2FBQy9CO1lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7U0FDdkY7UUFFRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVXLFFBQUEsTUFBTSxHQUFHLFVBQVUsT0FBd0I7SUFDdEQsTUFBTSxVQUFVLEdBQXlCLEVBQUUsQ0FBQztJQUU1QyxNQUFNLGFBQWEsR0FBRyxLQUFLLEVBQUUsR0FBRyxFQUFtQixFQUFFO1FBQ25ELEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRS9CLEtBQUssSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxVQUFVLEVBQUU7WUFDbkMsS0FBSyxDQUFDLFlBQVksSUFBSSxhQUFhLENBQUMsQ0FBQztZQUNyQyxHQUFHLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDckI7UUFFRCxNQUFNLEdBQUcsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUUvQixPQUFPO1lBQ0wsR0FBRyxHQUFHO1lBQ04sR0FBRyxHQUFHO1NBQ1AsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLGFBQWEsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBc0IsRUFBUSxFQUFFO1FBQ2pFLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO1lBQzlCLEVBQUUsR0FBRyxJQUFJLENBQUM7WUFDVixJQUFJLEdBQUcsU0FBUyxDQUFDO1NBQ2xCO1FBQ0QsS0FBSyxDQUFDLFVBQVUsSUFBSSxhQUFhLENBQUMsQ0FBQztRQUNuQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDaEMsQ0FBQyxDQUFDO0lBRUYsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyxDQUFDO0FBRUYsa0JBQWUsRUFBRSxPQUFPLEVBQVAsZUFBTyxFQUFFLE1BQU0sRUFBTixjQUFNLEVBQUUsQ0FBQyJ9
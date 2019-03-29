"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const graphql_toolkit_1 = require("graphql-toolkit");
const debug = debug_1.default('graphql-component:resolver');
exports.memoize = function (parentType, fieldName, resolve) {
    const _cache = new WeakMap();
    return function (_, args, context, info) {
        const key = JSON.stringify(args);
        debug(`executing ${parentType}.${fieldName}`);
        let cached = _cache.get(context);
        if (cached && cached[key]) {
            debug(`return cached result of memoized ${parentType}.${fieldName}`);
            return cached[key];
        }
        if (!cached) {
            cached = {};
        }
        const result = resolve(_, args, context, info);
        cached[key] = result;
        _cache.set(context, cached);
        debug(`cached ${parentType}.${fieldName}`);
        return result;
    };
};
exports.transformResolvers = function (resolvers, excludes) {
    let filteredResolvers = Object.assign({}, resolvers);
    for (const [root, name] of excludes) {
        if (root === '*') {
            filteredResolvers = {};
            break;
        }
        if (!name || name === '' || name === '*') {
            delete filteredResolvers[root];
            continue;
        }
        delete filteredResolvers[root][name];
    }
    return filteredResolvers;
};
exports.wrapResolvers = function (bind, resolvers) {
    const wrapped = {};
    for (const [name, value] of Object.entries(resolvers)) {
        if (!wrapped[name]) {
            wrapped[name] = {};
        }
        for (const [resolverName, func] of Object.entries(value)) {
            if (wrapped[name][resolverName]) {
                continue;
            }
            if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
                debug(`memoized ${name}.${resolverName}`);
                wrapped[name][resolverName] = exports.memoize(name, resolverName, func.bind(bind));
                continue;
            }
            wrapped[name][resolverName] = func.bind(bind);
        }
    }
    return wrapped;
};
exports.getImportedResolvers = function (component) {
    const importedResolvers = {};
    const allResolvers = graphql_toolkit_1.mergeResolvers([component.resolvers, component.importedResolvers]);
    for (const [parentType, resolvers] of Object.entries(allResolvers)) {
        if (!importedResolvers[parentType]) {
            importedResolvers[parentType] = {};
        }
        for (const [name, value] of Object.entries(resolvers)) {
            importedResolvers[parentType][name] = value.bind(component);
        }
    }
    return importedResolvers;
};
exports.default = {
    memoize: exports.memoize,
    transformResolvers: exports.transformResolvers,
    wrapResolvers: exports.wrapResolvers,
    getImportedResolvers: exports.getImportedResolvers
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3Jlc29sdmVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUNBLGtEQUE2QjtBQUc3QixxREFBaUQ7QUFFakQsTUFBTSxLQUFLLEdBQUcsZUFBUSxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFFeEMsUUFBQSxPQUFPLEdBQUcsVUFBVSxVQUFrQixFQUFFLFNBQWlCLEVBQUUsT0FBeUI7SUFDL0YsTUFBTSxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUU3QixPQUFPLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSTtRQUNyQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLEtBQUssQ0FBQyxhQUFhLFVBQVUsSUFBSSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBRTlDLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFakMsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ3pCLEtBQUssQ0FBQyxvQ0FBb0MsVUFBVSxJQUFJLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDckUsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDcEI7UUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsTUFBTSxHQUFHLEVBQUUsQ0FBQztTQUNiO1FBRUQsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRS9DLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUM7UUFFckIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFNUIsS0FBSyxDQUFDLFVBQVUsVUFBVSxJQUFJLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFM0MsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRVcsUUFBQSxrQkFBa0IsR0FBRyxVQUFVLFNBQXFCLEVBQUUsUUFBb0I7SUFDckYsSUFBSSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUVyRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksUUFBUSxFQUFFO1FBQ25DLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRTtZQUNoQixpQkFBaUIsR0FBRyxFQUFFLENBQUM7WUFDdkIsTUFBTTtTQUNQO1FBQ0QsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRSxJQUFJLElBQUksS0FBSyxHQUFHLEVBQUU7WUFDeEMsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMvQixTQUFTO1NBQ1Y7UUFDRCxPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3RDO0lBRUQsT0FBTyxpQkFBaUIsQ0FBQztBQUMzQixDQUFDLENBQUM7QUFFVyxRQUFBLGFBQWEsR0FBRyxVQUFVLElBQXVCLEVBQUUsU0FBcUI7SUFDbkYsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBRW5CLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQ3JELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDbEIsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNwQjtRQUVELEtBQUssTUFBTSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3hELElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxFQUFFO2dCQUMvQixTQUFTO2FBQ1Y7WUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7Z0JBQzVELEtBQUssQ0FBQyxZQUFZLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQyxDQUFDO2dCQUMxQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLEdBQUcsZUFBTyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMzRSxTQUFTO2FBQ1Y7WUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMvQztLQUNGO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyxDQUFDO0FBRVcsUUFBQSxvQkFBb0IsR0FBRyxVQUFVLFNBQTRCO0lBQ3hFLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBRTdCLE1BQU0sWUFBWSxHQUFHLGdDQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7SUFFeEYsS0FBSyxNQUFNLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDbEUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ2xDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUNwQztRQUVELEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3JELGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0Q7S0FDRjtJQUVELE9BQU8saUJBQWlCLENBQUM7QUFDM0IsQ0FBQyxDQUFDO0FBRUYsa0JBQWU7SUFDYixPQUFPLEVBQVAsZUFBTztJQUNQLGtCQUFrQixFQUFsQiwwQkFBa0I7SUFDbEIsYUFBYSxFQUFiLHFCQUFhO0lBQ2Isb0JBQW9CLEVBQXBCLDRCQUFvQjtDQUNyQixDQUFDIn0=
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default('graphql-component:types');
const iterateObjectTypes = function* (definitions) {
    for (const definition of definitions) {
        if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) > -1) {
            yield definition;
        }
    }
};
exports.check = function (operation, fieldName, excludes) {
    for (const filter in excludes) {
        const [root, name] = filter;
        if (root === '*') {
            return true;
        }
        return operation === root && (name === '' || name === '*' || name === fieldName);
    }
};
exports.exclude = function (types, excludes) {
    if (!excludes || excludes.length < 1) {
        return types;
    }
    for (const doc of types) {
        for (const def of iterateObjectTypes(doc.definitions)) {
            def.fields = def.fields.filter((field) => {
                if (!exports.check(def.name.value, field.name.value, excludes)) {
                    debug(`excluding ${def.name.value}.${field.name.value} from import`);
                    return false;
                }
                return true;
            });
        }
    }
    return types;
};
exports.getImportedTypes = function (component, excludes) {
    const types = component.types.map((type) => graphql_tag_1.default `${type}`);
    const importedTypes = component.importedTypes;
    return exports.exclude([...types, ...importedTypes], excludes);
};
exports.default = { exclude: exports.exclude, check: exports.check, getImportedTypes: exports.getImportedTypes };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFDQSw4REFBOEI7QUFFOUIsa0RBQTZCO0FBSTdCLE1BQU0sS0FBSyxHQUFHLGVBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRWxELE1BQU0sa0JBQWtCLEdBQUcsUUFBUyxDQUFDLEVBQUMsV0FBMEM7SUFDOUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7UUFDcEMsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLHNCQUFzQixJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtZQUMzSCxNQUFNLFVBQVUsQ0FBQztTQUNsQjtLQUNGO0FBQ0gsQ0FBQyxDQUFDO0FBRVcsUUFBQSxLQUFLLEdBQUcsVUFBVSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQW9CO0lBQ3ZFLEtBQUssTUFBTSxNQUFNLElBQUksUUFBUSxFQUFFO1FBQzdCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDO1FBRTVCLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRTtZQUNoQixPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsT0FBTyxTQUFTLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUUsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQztLQUNsRjtBQUNILENBQUMsQ0FBQTtBQUVZLFFBQUEsT0FBTyxHQUFHLFVBQVUsS0FBcUIsRUFBRSxRQUFxQjtJQUMzRSxJQUFJLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3BDLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssRUFBRTtRQUN2QixLQUFLLE1BQU0sR0FBRyxJQUFJLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUNyRCxHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ3ZDLElBQUksQ0FBQyxhQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUU7b0JBQ3RELEtBQUssQ0FBQyxhQUFhLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxjQUFjLENBQUMsQ0FBQztvQkFDckUsT0FBTyxLQUFLLENBQUM7aUJBQ2Q7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMsQ0FBQTtBQUVZLFFBQUEsZ0JBQWdCLEdBQUcsVUFBVSxTQUE0QixFQUFFLFFBQXFCO0lBQzNGLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxxQkFBRyxDQUFBLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMxRCxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDO0lBQzlDLE9BQU8sZUFBTyxDQUFDLENBQUMsR0FBRyxLQUFLLEVBQUUsR0FBRyxhQUFhLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN6RCxDQUFDLENBQUM7QUFFRixrQkFBZSxFQUFFLE9BQU8sRUFBUCxlQUFPLEVBQUUsS0FBSyxFQUFMLGFBQUssRUFBRSxnQkFBZ0IsRUFBaEIsd0JBQWdCLEVBQUUsQ0FBQyJ9
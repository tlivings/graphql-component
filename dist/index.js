"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const graphql_tools_1 = require("graphql-tools");
const graphql_toolkit_1 = require("graphql-toolkit");
const resolvers_1 = __importDefault(require("./resolvers"));
const context_1 = __importDefault(require("./context"));
const types_1 = __importDefault(require("./types"));
const fragments_1 = __importDefault(require("./fragments"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default('graphql-component:schema');
class GraphQLComponent {
    constructor({ types = [], resolvers = {}, imports = [], mocks, directives, context, useMocks, preserveTypeResolvers }) {
        debug(`creating component`);
        this._schema = undefined;
        this._types = Array.isArray(types) ? types : [types];
        this._resolvers = resolvers_1.default.wrapResolvers(this, resolvers);
        this._imports = [];
        this._directives = directives;
        this._context = context_1.default.builder(this, context);
        const importedTypes = [];
        const importedResolvers = [];
        for (const imp of imports) {
            if (GraphQLComponent.isComponent(imp)) {
                const component = imp;
                importedTypes.push(...types_1.default.getImportedTypes(component));
                importedResolvers.push(resolvers_1.default.getImportedResolvers(component));
                this._imports.push(component);
                continue;
            }
            const config = imp;
            if (!config.exclude || !config.exclude.length) {
                importedTypes.push(...types_1.default.getImportedTypes(config.component));
                importedResolvers.push(resolvers_1.default.getImportedResolvers(config.component));
            }
            else {
                const excludes = config.exclude.map((filter) => {
                    return filter.split('.');
                });
                importedTypes.push(...types_1.default.getImportedTypes(config.component, excludes));
                importedResolvers.push(resolvers_1.default.transformResolvers(resolvers_1.default.getImportedResolvers(config.component), excludes));
            }
            this._imports.push(config.component);
        }
        this._importedTypes = importedTypes;
        this._importedResolvers = graphql_toolkit_1.mergeResolvers(importedResolvers);
        this._useMocks = useMocks;
        this._importedMocks = Object.assign({}, ...this._imports.map((c) => c.mocks));
        this._mocks = mocks(this._importedMocks);
        this._preserveTypeResolvers = preserveTypeResolvers;
        this._mergedTypes = graphql_toolkit_1.mergeTypeDefs([...this._types, ...this._importedTypes]);
        this._mergedResolvers = graphql_toolkit_1.mergeResolvers([this._resolvers, this._importedResolvers]);
        this._fragments = fragments_1.default.buildFragments(this._mergedTypes);
    }
    static isComponent(component) {
        return !!(component.execute && component.types && component.resolvers && component.context);
    }
    async execute(input, { root = undefined, context = {}, variables = {} } = {}) {
        return await graphql_1.execute({ schema: this.schema, document: graphql_tag_1.default `${this._fragments.join('\n')}\n${input}`, rootValue: root, contextValue: context, variableValues: variables });
    }
    get schema() {
        if (this._schema) {
            return this._schema;
        }
        const typeDefs = this._mergedTypes;
        const resolvers = this._mergedResolvers;
        const schemaDirectives = this._directives;
        const schema = graphql_tools_1.makeExecutableSchema({
            typeDefs,
            resolvers,
            schemaDirectives
        });
        debug(`created ${this.constructor.name} schema`);
        if (this._useMocks) {
            debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);
            const mocks = Object.assign({}, this._importedMocks, this._mocks);
            graphql_tools_1.addMockFunctionsToSchema({ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
        }
        this._schema = schema;
        return this._schema;
    }
    get context() {
        return context_1.default.create(this._context.bind(this));
    }
    get types() {
        return this._types;
    }
    get importedTypes() {
        return this._importedTypes;
    }
    get resolvers() {
        return this._resolvers;
    }
    get importedResolvers() {
        return this._importedResolvers;
    }
    get imports() {
        return this._imports;
    }
    get mocks() {
        return this._mocks;
    }
}
exports.GraphQLComponent = GraphQLComponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFDQSxxQ0FBdUU7QUFDdkUsOERBQThCO0FBQzlCLGlEQUFpSDtBQUNqSCxxREFBaUY7QUFDakYsNERBQW9DO0FBQ3BDLHdEQUFnQztBQUNoQyxvREFBNEI7QUFDNUIsNERBQW9DO0FBR3BDLGtEQUE2QjtBQUU3QixNQUFNLEtBQUssR0FBRyxlQUFRLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUVuRCxNQUFhLGdCQUFnQjtJQWlCM0IsWUFBWSxFQUNWLEtBQUssR0FBRyxFQUFFLEVBQ1YsU0FBUyxHQUFHLEVBQUUsRUFDZCxPQUFPLEdBQUcsRUFBRSxFQUNaLEtBQUssRUFDTCxVQUFVLEVBQ1YsT0FBTyxFQUNQLFFBQVEsRUFDUixxQkFBcUIsRUFDSDtRQUNsQixLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUU1QixJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQztRQUV6QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCxJQUFJLENBQUMsVUFBVSxHQUFHLG1CQUFTLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUUzRCxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUVuQixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUU5QixJQUFJLENBQUMsUUFBUSxHQUFHLGlCQUFPLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUUvQyxNQUFNLGFBQWEsR0FBRyxFQUFFLENBQUM7UUFDekIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7UUFFN0IsS0FBSyxNQUFNLEdBQUcsSUFB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
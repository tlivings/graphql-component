import { IGraphQLComponent } from './interface.types';
import { DocumentNode } from 'graphql';
export declare const check: (operation: any, fieldName: any, excludes: string[][]) => boolean;
export declare const exclude: (types: DocumentNode[], excludes?: string[][]) => DocumentNode[];
export declare const getImportedTypes: (component: IGraphQLComponent, excludes?: string[][]) => DocumentNode[];
declare const _default: {
    exclude: (types: DocumentNode[], excludes?: string[][]) => DocumentNode[];
    check: (operation: any, fieldName: any, excludes: string[][]) => boolean;
    getImportedTypes: (component: IGraphQLComponent, excludes?: string[][]) => DocumentNode[];
};
export default _default;

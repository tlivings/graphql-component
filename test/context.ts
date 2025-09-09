import test from 'tape';
import GraphQLComponent from '../src/index';

test('GraphQLComponent Context Tests', (t) => {
  t.test('should build context with middleware', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`
    });

    const contextFn = component.context;
    contextFn.use('test', async (ctx) => ({
      ...ctx,
      testValue: 'test'
    }));

    const context = await contextFn({});
    assert.equal(context.testValue, 'test', 'middleware was applied');
    assert.end();
  });

  t.test('should handle multiple middleware in order', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`
    });

    const contextFn = component.context;
    contextFn.use('first', async (ctx) => ({
      ...ctx,
      value: 1
    }));
    contextFn.use('second', async (ctx) => ({
      ...ctx,
      value: (ctx.value as number) + 1
    }));

    const context = await contextFn({});
    assert.equal(context.value, 2, 'middleware executed in order');
    assert.end();
  });

  t.test('should have dataSources available in middleware', async (assert) => {
    class TestDataSource {
      name = 'TestDataSource';
      
      getData(context: any, id: string) {
        return { id, fromDataSource: true };
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TestDataSource()]
    });

    let middlewareDataSources: any = null;
    const contextFn = component.context;
    contextFn.use('dataSourceTest', async (ctx) => {
      middlewareDataSources = ctx.dataSources;
      return {
        ...ctx,
        middlewareRan: true
      };
    });

    const context = await contextFn({});
    
    assert.ok(middlewareDataSources, 'dataSources available in middleware');
    assert.ok(middlewareDataSources.TestDataSource, 'TestDataSource available in middleware');
    assert.equal(typeof middlewareDataSources.TestDataSource.getData, 'function', 'dataSource method available');
    assert.ok(context.middlewareRan, 'middleware executed');
    assert.end();
  });

  t.test('should preserve imported dataSources in context', async (assert) => {
    class ImportedDataSource {
      name = 'ImportedDataSource';
      
      getImportedData(context: any, id: string) {
        return { id, fromImportedDataSource: true };
      }
    }

    class LocalDataSource {
      name = 'LocalDataSource';
      
      getLocalData(context: any, id: string) {
        return { id, fromLocalDataSource: true };
      }
    }

    const importedComponent = new GraphQLComponent({
      types: `type ImportedQuery { imported: String }`,
      dataSources: [new ImportedDataSource()]
    });

    const mainComponent = new GraphQLComponent({
      types: `type Query { local: String }`,
      dataSources: [new LocalDataSource()],
      imports: [importedComponent]
    });

    const context = await mainComponent.context({});
    
    assert.ok(context.dataSources, 'dataSources available in context');
    
    // Check that imported dataSource is available
    assert.ok(context.dataSources.ImportedDataSource, 'ImportedDataSource available in context');
    assert.equal(typeof context.dataSources.ImportedDataSource.getImportedData, 'function', 'imported dataSource method available');
    
    // Check that local dataSource is also available
    assert.ok(context.dataSources.LocalDataSource, 'LocalDataSource available in context');
    assert.equal(typeof context.dataSources.LocalDataSource.getLocalData, 'function', 'local dataSource method available');
    
    assert.end();
  });

  t.end();
}); 
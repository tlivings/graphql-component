
const { ApolloServer } = require('apollo-server');
const ListingComponent = require('../listing-component');

const { schema, context} = new ListingComponent({ 
  useMocks: !!process.env.GRAPHQL_MOCK, 
  preserveResolvers: true,
  //Data source overriding
  dataSourceOverrides: [
    new class MockDataSource {
      static get name() {
        return 'PropertyDataSource';
      }
      getPropertyById(context, id) {
        return {
          id: 'override id',
          geo: ['lat', 'long']
        };
      }
    }
  ]
});

const server = new ApolloServer({ schema, context, tracing: true });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});

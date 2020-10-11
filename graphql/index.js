const { ApolloServer, gql } = require("apollo-server-azure-functions");
const { RESTDataSource } = require("apollo-datasource-rest");
const DataLoader = require("dataloader");

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type Query {
    healthcheck: String
    launches(id: String): [Launch]
    launchpads(id: String): [Launchpad]
  }
  type Launch {
    id: String
    name: String
    launchpad: Launchpad
  }
  type Launchpad {
    id: String
    name: String
    latitude: Float
    longitude: Float
    launches: [Launch]
  }
`;

class SpaceXAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = "https://api.spacexdata.com/v4/";
    this.launchpadLoader = new DataLoader(async (ids) => {
      const queryBody = {
        query: {
          _id: {
            $in: ids,
          },
        },
      };
      const response = await this.post(`launchpads/query`, queryBody);
      return response.docs;
    });
  }

  async getLaunches() {
    return this.get(`launches`);
  }

  async getLaunch(id) {
    return this.get(`launches/${id}`);
  }

  async loadLaunchpad(id) {
    return this.launchpadLoader.load(id);
  }

  async getLaunchpads() {
    return this.get(`launchpads`);
  }
}

const launchesResolver = async (parent, args, context) => {
  const {
    dataSources: { spaceXAPI },
  } = context;

  // Called as child - return object
  if (parent && parent.launch) {
    const id = parent.launch;
    const response = await spaceXAPI.getLaunch(id);
    return response;
  }

  // Called as id filter - return array
  if (args && args.id) {
    const id = args.id;
    const response = await spaceXAPI.getLaunch(id);
    return [response];
  }

  // No id specified - get all
  return spaceXAPI.getLaunches();
};

const launchpadsResolver = async (parent, args, context) => {
  const {
    dataSources: { spaceXAPI },
  } = context;

  // Called as child - return object
  if (parent && parent.launchpad) {
    const id = parent.launchpad;
    const response = await spaceXAPI.loadLaunchpad(id);
    return response;
  }

  // Called as id filter - return array
  if (args && args.id) {
    const id = args.id;
    const response = await spaceXAPI.loadLaunchpad(id);
    return [response];
  }

  // No id specified - get all
  return spaceXAPI.getLaunchpads();
};

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    healthcheck: () => "🚀 GQL API ruuning!",
    launches: launchesResolver,
    launchpads: launchpadsResolver,
  },
  Launch: {
    launchpad: launchpadsResolver,
  },
  Launchpad: {
    launches: launchesResolver,
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({ spaceXAPI: new SpaceXAPI() }),
  tracing: true,
});

exports.graphqlHandler = server.createHandler();

# Matrix-Backend

**Matrix-Backend** serves as an interface between the user and the Raspberry Pi controller. It facilitates data exchange between various WebSocket clients and offers a RESTful API for managing user data and interactions.

## Installation

```bash
npm install
```
## Usage

### Start the Server

Run the following command to start the server locally:

```bash
npm run start-local
```
By default, the server runs on http://localhost:3000.

### Endpoints

All endpoints require a valid JWT token in the `Authorization` header (`Bearer <Token>`).

#### WebSocket Endpoints

- **POST** `/api/websocket/broadcast`  
  Sends a message to all connected WebSocket clients.

- **POST** `/api/websocket/send-message`  
  Sends a message to the authenticated user.

- **GET** `/api/websocket/all-clients`  
  Returns a list of all connected WebSocket clients.

#### REST API Endpoints

- **GET** `/api/user`  
  Returns a list of all users.

- **GET** `/api/user/:id`  
  Returns a user by the provided ID.

- **GET** `/api/jwt/_id`  
  Extracts the user ID from the provided JWT token.

- **PUT** `/api/user/:id`  
  Updates a user based on the given ID.  
  The expected JSON format for the request body:

  ```json
  {
    "name": "string",
    "uuid": "string",
    "id": "ObjectId",
    "config": {
      "isVisible": "boolean",
      "canBeModified": "boolean",
      "isAdmin": "boolean"
    }
  }
  ```
  ## Environment Variables

The following environment variables are required for the application to function properly:

### Required Variables:

- **DB_CONN_STRING**: The connection string to your MongoDB database.  
  Example: `mongodb://localhost:27017`

- **DB_NAME**: The name of the MongoDB database to use.  
  Example: `matrix_backend`

- **USER_COLLECTION_NAME**: The name of the MongoDB collection that holds user data.  
  Example: `users`

- **SECRET_KEY**: The secret key used to sign and verify JWT tokens.  
  Example: `mysecretkey12345`

### Example `.env` File:

Create a `.env` file in the root of your project with the following content:

```env
DB_CONN_STRING=mongodb://localhost:27017
DB_NAME=matrix_backend
USER_COLLECTION_NAME=users
SECRET_KEY=mysecretkey12345

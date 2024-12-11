# Matrix-Backend

## Project Overview
The **Matrix-Backend** is a TypeScript-based server project that provides WebSocket communication, REST API endpoints, and integration with external services such as Spotify and OpenWeatherMap. It offers a modular and extensible architecture for various applications.

**Matrix-Backend** serves as an interface between the user and the Raspberry Pi controller. It facilitates data exchange between various WebSocket clients and offers a RESTful API for managing user data and interactions.


## Features
- **WebSocket Support**: Enables real-time communication.
- **REST API**: Endpoints for user management, authentication, and API interactions.
- **External API Integration**:
  - **Spotify**: Token management and API access.
  - **OpenWeatherMap**: Access to weather data.
- **JWT Authentication**: Secures the API using JSON Web Tokens (JWT).

## Project Structure
```
matrix-backend/
├── src/
│   ├── index.ts                # Main entry point
│   ├── websocket.ts           # WebSocket implementation
│   ├── db/
│   │   ├── models/            # Data models
│   │   └── services/          # API and database services
│   ├── rest/                  # REST endpoints and middleware
│   ├── interfaces/            # Types and interfaces
│   └── utils/                 # Utility functions
├── package.json               # Project metadata and dependencies
├── tsconfig.json              # TypeScript configuration
├── .env                       # Environment variables (do not commit to Git!)
└── README.md                  # Project documentation
```

## Installation

### Prerequisites
- **Node.js**: Version 16 or higher
- **npm**: Version 7 or higher

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/StarAppeal/matrix-backend.git
   cd matrix-backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file based on the template in `.env.example`.

4. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Development Mode
```bash
npm run start-local
```

### Production Mode
```bash
npm run start
```

## Scripts
- `npm run start`: Starts the application using PM2.
- `npm run start-local`: Starts the application in development mode.
- `npm run build`: Builds the project (TypeScript -> JavaScript).
- `npm run clean`: Removes old build artifacts.

## Endpoints

### WebSocket
- **Path**: `/websocket`
- **Function**: Enables real-time communication between clients and the server.

### REST API
#### Authentication
- **POST** `/auth/register`
  - **Description**: Registers a new user.
  - **Request Body**:
    ```json
    {
      "username": "string",
      "password": "string",
      "email": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "message": "string",
      "userId": "string"
    }
    ```

- **POST** `/auth/login`
  - **Description**: Logs in a user and generates a JWT.
  - **Request Body**:
    ```json
    {
      "username": "string",
      "password": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "token": "string",
      "refreshToken": "string"
    }
    ```

- **POST** `/auth/refresh`
  - **Description**: Refreshes an expired JWT using a refresh token.
  - **Request Body**:
    ```json
    {
      "refreshToken": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "token": "string"
    }
    ```

#### Token Properties
- **GET** `/auth/id`
  - **Description**: Retrieves the user's ID from the JWT.
  - **Response**:
    ```json
    {
      "id": "string"
    }
    ```

- **GET** `/auth/username`
  - **Description**: Retrieves the user's username from the JWT.
  - **Response**:
    ```json
    {
      "username": "string"
    }
    ```

- **GET** `/auth/uuid`
  - **Description**: Retrieves the user's UUID from the JWT.
  - **Response**:
    ```json
    {
      "uuid": "string"
    }
    ```

#### User Management
- **GET** `/user`
  - **Description**: Lists all users.
  - **Response**:
    ```json
    [
      {
        "id": "string",
        "username": "string",
        "email": "string"
      }
    ]
    ```

- **GET** `/user/me`
  - **Description**: Retrieves details of the currently authenticated user.
  - **Response**:
    ```json
    {
      "id": "string",
      "username": "string",
      "email": "string"
    }
    ```

- **PUT** `/user/me/spotify`
  - **Description**: Updates the user's Spotify information.
  - **Request Body**:
    ```json
    {
      "spotifyToken": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "message": "Spotify information updated successfully."
    }
    ```

- **PUT** `/user/me/password`
  - **Description**: Updates the user's password.
  - **Request Body**:
    ```json
    {
      "oldPassword": "string",
      "newPassword": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "message": "Password updated successfully."
    }
    ```

- **GET** `/user/:id`
  - **Description**: Retrieves details of a specific user by ID.
  - **Response**:
    ```json
    {
      "id": "string",
      "username": "string",
      "email": "string"
    }
    ```

#### WebSocket Management
- **POST** `/websocket/broadcast`
  - **Description**: Sends a broadcast message to all connected WebSocket clients.
  - **Request Body**:
    ```json
    {
      "message": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "status": "success",
      "clientsNotified": "number"
    }
    ```

- **POST** `/websocket/send-message`
  - **Description**: Sends a direct message to a specific WebSocket client.
  - **Request Body**:
    ```json
    {
      "clientId": "string",
      "message": "string"
    }
    ```
  - **Response**:
    ```json
    {
      "status": "success",
      "clientNotified": "boolean"
    }
    ```

- **GET** `/websocket/all-clients`
  - **Description**: Retrieves a list of all connected WebSocket clients.
  - **Response**:
    ```json
    [
      {
        "clientId": "string",
        "status": "string"
      }
    ]
    ```

#### Spotify Token Management
- **GET** `/spotify/token/refresh/:refresh_token`
  - **Description**: Refreshes a Spotify token using a provided refresh token.
  - **Response**:
    ```json
    {
      "token": "string",
      "expiresIn": "number"
    }
    ```

- **GET** `/spotify/token/generate/code/:auth_code/redirect-uri/:redirect_uri`
  - **Description**: Generates a Spotify token using an authorization code and redirect URI.
  - **Response**:
    ```json
    {
      "token": "string",
      "refreshToken": "string",
      "expiresIn": "number"
    }
    ```

## Dependencies
- **Express**: Web server
- **ws**: WebSocket support
- **jsonwebtoken**: JWT processing
- **axios**: HTTP client

## Development
### Linter and Formatting
- Run `npm run lint` to check the code.

## License
This project is licensed under the [MIT License](LICENSE).

---

For questions or contributions, contact the project maintainer or open an issue in the repository.


# MyAgilityQs - AKC Canine Agility Tracking Application

Write a React application to track an individual's results in AKC Canine Agility. The app will essentially be a database of all the Qualifying Scores, or "Qs", that a dog has achieved. A "Q" means that the dog completed an agility course successfully, with no mistakes. The purpose of this system is to help an agility competitor keep track of how many Qs each of their dogs has achieved. This is important because dogs progress through the levels as they get more Qs. Once a dog is in the "Masters" level in both the Standard and Jumpers classes, the competitor will also want to track their "Double Qs" (or "QQs"). This means that the dog earned a Q in both Standard and Jumpers on the same date. A dog who earns 20 QQs becomes a Master Agility Champion (MACH)!

## Project Setup & Structure

### Project Organization

- Use a monorepo structure with separate folders for frontend and backend
- Package manager: npm
- Build tool: Vite for the frontend
- Project structure:
  ```
  /
  ├── client/          # React TypeScript app
  ├── server/           # AWS Lambda functions
  ├── infrastructure/    # AWS CDK or CloudFormation
  ├── shared/           # Shared types and utilities
  └── docs/             # Documentation
  ```

### Development Environment

- Node.js version: 22+
- Local development setup with AWS LocalStack or similar
- Environment variables management with dotenv
- Hot reload for both frontend and backend during development

# Data Model

## Users

Users should create accounts and log into the system using the AWS Cognito identity system. Support for "Sign in with Google" should be included.

**User Attributes:**

- User ID (Cognito UUID)
- Email (this will serve as the username)

**Authentication Requirements:**

- JWT token with 90 day expiration
- Refresh token handling for seamless re-authentication
- Session persistence across browser sessions

## Dogs

Each user can track data for one or more dogs. Every data record that comes after this will pertain to a specific dog.

**Dog Attributes:**

- Dog ID (UUID)
- User ID (foreign key)
- Name (required, max length 50)
- Active (boolean, default true)
- Competition Classes (array of objects):
  - Class Name: Standard, Jumpers, T2B, FAST, Premier Standard, Premier Jumpers
  - Current Level: Novice, Open, Excellent, Masters

**Validation Rules:**

- Name must be unique per user
- At least one competition class must be selected

## Runs

A run represents a single instance of a dog running an agility course.

**Run Attributes:**

- Run ID (UUID)
- Dog ID (foreign key)
- Date (required, format: YYYY-MM-DD)
- Class (required): Standard, Jumpers, T2B, FAST, Premier Standard, Premier Jumpers
- Level (required): Novice, Open, Excellent, Masters
- Qualified (boolean, default true)
- Placement (integer, 1-4 for placements, null for no placement)
- Time (optional, decimal seconds, e.g., 45.23)
- MACH Points (optional, integer, user-entered)
- Location (optional, string, max length 100)
- Notes (optional, string, max length 1000)

**Business Logic:**

- QQ (Double Q) Rules:
  - Must have qualifying runs in both Standard AND Jumpers
  - Both runs must be at Masters level
  - Both runs must be on the same date

## Database Design (DynamoDB Single Table)

**Partition Key (PK) / Sort Key (SK) Structure:**

- Users: PK=`USER#{userId}`, SK=`PROFILE`
- Dogs: PK=`USER#{userId}`, SK=`DOG#{dogId}`
- Runs: PK=`USER#{userId}#DOG#{dogId}`, SK=`RUN#{date}#{runId}`

**Global Secondary Indexes:**

- GSI1: PK=`DOG#{dogId}`, SK=`RUN#{date}` (for date-based queries)

# User Interface & Experience

## Design System

- **Color Scheme:** Light mode, white background, black text, dark blue UI elements (buttons etc)
- **Typography:** Mantine default
- **Component Library:** Mantine with custom theme
- **Responsive Breakpoints:**
  - Mobile: 320px - 768px (primary target)
  - Tablet: 768px - 1024px
  - Desktop: 1024px+

## Loading States & Error Handling

- Skeleton loading for data tables
- Spinner for form submissions
- Toast notifications for success/error messages

Users will log into the app using AWS Cognito, with the option to "Sign in with Google". Once the user is signed in, they should stay signed in. This app is not dealing with highly sensitive data, so the security can be relaxed.

The app should be optimized for quickly entering a run. It will be common to use the app on a mobile device, so it should be responsive and optimized for touch-entry.

## Navigation Structure

- Once logged in, the main page is a stack of buttons
- Main sections: Add Run, View Runs, Title Progress, My Dogs, Profile/Settings
- Back-navigation should be via browser back button and by a left-arrow next to the page header

## Add a Run

**Workflow:**

1. Pick a dog from your list of saved dogs. Each user will have a small number of active dogs (typically 1 to 3), so each dog can be shown as a button.
2. Pick a class from among those that the dog is configured to compete in. Typically a dog will only compete in 1-4 classes. Most common is 2: Standard and Jumpers.
3. Enter the run details:
   - Date (default to today, with date picker)
   - Qualified (default to true; most users will only use this app to track runs in which they did qualify)
   - Placement (quick access buttons for 1, 2, 3, 4, None)
   - Optional fields: time, MACH points, and location

**UX Enhancements:**

- Location auto-suggestion based on previous entries (competitors often attend competitions at the same small number of venues)
- Form validation with inline error messages

## View Runs

This will be a table-view of the data, with the ability to quickly filter by: dog, class, level. By default it will show all runs, but with an option to show only runs where "Qualified = true".

**Features:**

- Sortable columns (date, class, level, time, placement)
- Tap on a row to open the run and be able to edit or delete it (with confirmation)

## Title Progress

This will show a tabulation of how many Qs each dog has earned in each class and level. If a dog has at least one Q in both Masters Standard and Masters Jumpers, it will also tabulate how many QQs the dog has earned.

For example:

- Piper
  - Standard
    - Novice: 3
    - Open: 2
  - Jumpers
    - Novice: 3
    - Open: 3
    - Excellent: 2
  - QQs: 0 (MACH Progress: 0/20)

## My Dogs

Manage your list of dogs, either adding a new one or editing an existing one. We won't delete dogs, but a dog can be marked inactive if they no longer compete.

**Features:**

- Dog profile with photo upload capability
- Competition class management (add/remove classes, update levels)
- Activity status toggle

# API Design

## Endpoints Structure

### Authentication Endpoints

- `POST /auth/login` - Cognito login
- `POST /auth/google` - Google OAuth login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user

### Dog Management

- `GET /dogs` - Get user's dogs
- `POST /dogs` - Create new dog
- `PUT /dogs/{dogId}` - Update dog
- `PATCH /dogs/{dogId}/status` - Toggle active status

### Run Management

- `GET /runs` - Get runs (with filtering)
- `GET /runs/{dogId}` - Get runs for specific dog
- `POST /runs` - Create new run
- `PUT /runs/{runId}` - Update run
- `DELETE /runs/{runId}` - Delete run (hard delete)

## Request/Response Format

- Content-Type: `application/json`
- Standard HTTP status codes
- Error response format:
  ```json
  {
    "error": "error_code",
    "message": "Human readable message",
    "details": {} // Optional additional context
  }
  ```

## Pagination & Filtering

- Limit/offset pagination: `?limit=25&offset=0`
- Filtering: `?dog={dogId}&class={className}&qualified=true`
- Sorting: `?sort=date&order=desc`

# Tech Stack

## Front End

- **TypeScript** - Strict mode enabled
- **React 18+** with hooks and functional components
- **Vite** - Build tool and development server
- **[Mantine](https://mantine.dev/core/package/)** - UI components with custom theme
- **[Mantine Form](https://mantine.dev/form/package/)** - Form management with validation
- **[Wouter](https://github.com/molefrog/wouter)** - Lightweight client-side routing
- **TanStack Query** - Data fetching, caching, and synchronization
- **[Ky](https://github.com/sindresorhus/ky)** - HTTP client wrapper for fetch
- **[Zod](https://zod.dev/)** - Runtime type validation for API responses
- **[Day.js](https://day.js.org/)** - Date manipulation utilities

### State Management

- TanStack Query for server state
- React useState/useReducer for local component state
- Zustand if needed, but state should mostly be in TanStack Query and the URL

### Development Tools

- **ESLint** + **Prettier** - Code quality and formatting

## Back End

- **Node.js** (version 22+)
- **AWS Lambda** - Serverless functions
- **[Middy](https://github.com/middyjs/middy)** - Lambda middleware framework
- **TypeScript** - Shared types with frontend
- **AWS SDK v3** - AWS service interactions

### API Structure

- Single Lambda function with Middy routing
- HTTP API Gateway (not REST API)

### Authentication & Security

- **AWS Cognito** - User management and authentication
- **Google OAuth 2.0** - Social login integration
- **JWT** token validation middleware
- **CORS** configuration for frontend domain

### Database

- **AWS DynamoDB** - NoSQL database, on-demand capacity
- **Single-table design** pattern
- Local development with DynamoDB Local or LocalStack

### Infrastructure as Code

- **AWS CDK** (TypeScript)
- **CI/CD Pipeline** with **GitHub Actions**
- **Environment Management**: dev (local), staging (cloud), prod (cloud)

### Development Setup

- **Local Development**:
  - Frontend: Vite dev server with proxy to local Lambda
  - Backend: SAM CLI or Serverless Framework for local invocation
  - Database: DynamoDB Local
- **Environment Variables**: Lambda environment variables

## Deployment & Operations

### Browser Support

- Last 2 versions of major browsers
- **Mobile-first approach** with progressive enhancement

# Implementation Guidance

## Development Order

1. **Project Setup**: Initialize monorepo structure, configure build tools
2. **Shared Types**: Define TypeScript interfaces in shared folder
3. **Backend Core**: Basic Lambda setup with auth middleware
4. **Authentication**: Implement Cognito login and JWT validation
5. **Dog Management**: CRUD operations for dogs (simplest entity)
6. **Run Management**: CRUD operations for runs
7. **Frontend Routing**: Set up Wouter with basic page structure
8. **Add Run Form**: Most critical user flow
9. **View Runs Table**: Display and filtering functionality
10. **Title Progress**: Statistics calculation and display
11. **Polish & Testing**: Error handling, loading states, responsive design

## Key Implementation Notes

### Form Behavior

- **Add Run Form**: Should go back to main menu after submission, with success toast auto-disappearing after 3 seconds
- **Validation**: Show errors inline as user moves past each field ("onblur"), not just on submit

### Data Synchronization

- **Optimistic Updates**, **Offline Handling**, **Real-time Updates**: Not required for this personal app

### Mobile Optimizations

- **Touch Targets**: Minimum 44px touch target size
- **Keyboard Behavior**: Proper input types (number, date, etc.), native date picker controls
- **Viewport**: Prevent zoom on input focus

# Additional Features to Consider

### Phase 2 Features

- **Photo Management**: Attach a photo of each dog
- **Data Import**: From CSV
- **Quick Stats**: Show recent runs, upcoming milestones on dashboard
- **Data Export**: CSV export for backup purposes

## Sample Data

To help with development and testing, here are some realistic sample data:

### Sample Dogs

```json
[
  {
    "name": "Piper",
    "active": true,
    "classes": [
      { "name": "Standard", "level": "Open" },
      { "name": "Jumpers", "level": "Excellent" }
    ]
  },
  {
    "name": "Luna",
    "active": true,
    "classes": [
      { "name": "Standard", "level": "Masters" },
      { "name": "Jumpers", "level": "Masters" },
      { "name": "FAST", "level": "Novice" }
    ]
  }
]
```

### Sample Locations

- "Sportika"
- "Horse Park of NJ"
- "Dream Park"

### Sample Runs

```json
[
  {
    "dogId": "piper-id",
    "date": "2025-06-15",
    "class": "Standard",
    "level": "Open",
    "qualified": true,
    "placement": 2,
    "time": 42.15,
    "machPoints": null,
    "location": "Sportika"
  },
  {
    "dogId": "luna-id",
    "date": "2025-06-15",
    "class": "Jumpers",
    "level": "Masters",
    "qualified": true,
    "placement": null,
    "time": 52.1,
    "machPoints": 1
  }
]
```

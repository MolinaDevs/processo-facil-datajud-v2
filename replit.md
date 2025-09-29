# Overview

This is a Brazilian legal process lookup application that allows users to search for judicial processes through the DataJud CNJ API. The application provides a modern web interface for searching court cases, viewing process details, managing search history, and maintaining a favorites list. It features real-time process information retrieval from various Brazilian courts including superior courts (STJ, STF, TST), federal courts (TRF1-6), and state courts (TJSP, TJRJ, etc.).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent UI components
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Management**: React Hook Form with Zod validation for type-safe form handling
- **UI Components**: Extensive use of Radix UI primitives through shadcn/ui for accessibility

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Development**: tsx for TypeScript execution in development
- **API Design**: RESTful API endpoints following standard HTTP conventions
- **Error Handling**: Centralized error handling middleware with structured error responses
- **Logging**: Custom request logging middleware for API endpoints

## Data Storage Solutions
- **Database**: PostgreSQL configured through Drizzle ORM
- **ORM**: Drizzle ORM with TypeScript-first approach for type safety
- **Schema Management**: Shared schema definitions between client and server
- **Development Storage**: In-memory storage implementation for development/testing
- **Migrations**: Drizzle Kit for database schema migrations and management

## Core Data Models
- **Search History**: Tracks user searches with process numbers, tribunals, and result data
- **Favorites**: Persistent storage of favorited processes with full process metadata
- **Process Results**: Structured data from DataJud API including movements, parties, and case details

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store
- **Security**: CORS configuration and request validation
- **API Security**: Environment-based API key management for DataJud integration

## Build and Deployment
- **Client Build**: Vite handles frontend bundling with React plugin
- **Server Build**: esbuild for server-side bundling with Node.js target
- **Development**: Concurrent development server with HMR support
- **Production**: Optimized builds with static asset serving

# External Dependencies

## Third-Party Services
- **DataJud CNJ API**: Official Brazilian judicial data API for court process lookup
- **Neon Database**: Serverless PostgreSQL database hosting
- **Font Services**: Google Fonts for typography (Inter, DM Sans, Fira Code, Geist Mono)

## Core Libraries
- **UI Framework**: React 18 with TypeScript support
- **Build Tools**: Vite for frontend, esbuild for backend bundling
- **Database**: Drizzle ORM with PostgreSQL dialect and Neon serverless driver
- **Validation**: Zod for runtime type validation and schema definition
- **HTTP Client**: Native fetch API with custom wrapper for type safety
- **Date Handling**: date-fns with Portuguese Brazil locale support

## Development Tools
- **Replit Integration**: Vite plugins for Replit development environment
- **Code Quality**: TypeScript strict mode with comprehensive type checking
- **Session Storage**: connect-pg-simple for PostgreSQL session management
- **Component Library**: shadcn/ui with Radix UI primitives for accessibility
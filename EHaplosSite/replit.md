# Overview

E-HAPLOS PROJECT is a medical device interface application that simulates and displays data from Force-Sensing Resistors (FSR) and Electrical Impedance Spectroscopy (EIS) sensors. The application provides a comprehensive dashboard for monitoring patient sensor data with real-time visualization capabilities. Built as a full-stack web application, it features a React frontend with shadcn/ui components and an Express.js backend, designed to interface with ESP32-based medical sensing hardware.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Single-page application using functional components and hooks
- **Styling Framework**: Tailwind CSS with shadcn/ui component library for consistent, accessible UI components
- **State Management**: React hooks (useState, useEffect) for local component state
- **Data Fetching**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Recharts library for real-time data visualization and frequency vs impedance graphs
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Server Framework**: Express.js with TypeScript for REST API endpoints
- **Development Setup**: Hot reload with tsx for development, esbuild for production bundling
- **Data Storage**: In-memory storage implementation with interface for future database integration
- **Session Management**: Connect-pg-simple for PostgreSQL session storage (prepared for database integration)

## Component Design Patterns
- **UI Components**: Radix UI primitives wrapped with custom styling using class-variance-authority
- **Form Handling**: React Hook Form with Zod validation schemas
- **Accessibility**: Built-in ARIA compliance through Radix UI components
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

## Data Layer Architecture
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe database operations
- **Schema Management**: Centralized schema definitions in shared directory for frontend/backend consistency
- **Validation**: Zod schemas for runtime type checking and data validation
- **Migration System**: Drizzle Kit for database schema migrations

## Medical Device Simulation
- **Device Connection**: Simulated Bluetooth connection workflow with status indicators
- **Sensor Data**: Mock FSR (Force-Sensing Resistor) and EIS (Electrical Impedance Spectroscopy) data generation
- **Real-time Updates**: Interval-based data updates with calibration phases
- **Data Visualization**: Live frequency vs impedance magnitude charts with configurable frequency ranges

# External Dependencies

## Core Framework Dependencies
- **@tanstack/react-query**: Server state management and data synchronization
- **wouter**: Lightweight routing solution for React applications
- **express**: Node.js web application framework for backend API

## Database and ORM
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-kit**: Database migration and schema management tools
- **@neondatabase/serverless**: Serverless PostgreSQL database driver
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## UI Component Libraries
- **@radix-ui/react-***: Comprehensive set of accessible, unstyled UI primitives
- **tailwindcss**: Utility-first CSS framework for styling
- **class-variance-authority**: Type-safe component variant management
- **lucide-react**: Icon library for consistent iconography

## Form and Validation
- **react-hook-form**: Performant forms with minimal re-renders
- **@hookform/resolvers**: Validation resolvers for React Hook Form
- **zod**: TypeScript-first schema validation library
- **drizzle-zod**: Integration between Drizzle ORM and Zod validation

## Data Visualization
- **recharts**: React charting library for medical data visualization
- **embla-carousel-react**: Touch-friendly carousel component

## Development Tools
- **vite**: Fast build tool and development server
- **tsx**: TypeScript execution environment for development
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling

## Utility Libraries
- **clsx**: Conditional className utility
- **tailwind-merge**: Tailwind class merging utility
- **date-fns**: Modern JavaScript date utility library
- **cmdk**: Command palette component for enhanced UX
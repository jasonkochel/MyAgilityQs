import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MainMenuPage } from "../pages/MainMenuPage";

// Mock Wouter
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", mockSetLocation],
}));

// Mock AuthContext with test user
vi.mock("../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { email: "test@example.com", id: "test-id" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider>{children}</MantineProvider>
      </QueryClientProvider>
    );
  };
};

describe("MainMenuPage", () => {
  it("renders main menu with all navigation options", () => {
    const TestWrapper = createTestWrapper();

    render(
      <TestWrapper>
        <MainMenuPage />
      </TestWrapper>
    );

    // Check app title
    expect(screen.getByText("MyAgilityQs")).toBeInTheDocument();

    // Check welcome message
    expect(screen.getByText("Welcome back, test@example.com")).toBeInTheDocument();

    // Check all menu buttons
    expect(screen.getByText("Add Run")).toBeInTheDocument();
    expect(screen.getByText("View Runs")).toBeInTheDocument();
    expect(screen.getByText("Title Progress")).toBeInTheDocument();
    expect(screen.getByText("My Dogs")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    // Check descriptions
    expect(screen.getByText("Record a new agility run")).toBeInTheDocument();
    expect(screen.getByText("Browse and manage your runs")).toBeInTheDocument();
    expect(screen.getByText("Track Qs and title progress")).toBeInTheDocument();
    expect(screen.getByText("Manage your dogs")).toBeInTheDocument();
    expect(screen.getByText("Settings and account")).toBeInTheDocument();
  });

  it("navigates to correct routes when buttons are clicked", async () => {
    const TestWrapper = createTestWrapper();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MainMenuPage />
      </TestWrapper>
    );

    // Test Add Run navigation
    const addRunButton = screen.getByText("Add Run");
    await user.click(addRunButton);
    expect(mockSetLocation).toHaveBeenCalledWith("/add-run");

    // Test View Runs navigation
    const viewRunsButton = screen.getByText("View Runs");
    await user.click(viewRunsButton);
    expect(mockSetLocation).toHaveBeenCalledWith("/view-runs");

    // Test Title Progress navigation
    const titleProgressButton = screen.getByText("Title Progress");
    await user.click(titleProgressButton);
    expect(mockSetLocation).toHaveBeenCalledWith("/title-progress");

    // Test My Dogs navigation
    const myDogsButton = screen.getByText("My Dogs");
    await user.click(myDogsButton);
    expect(mockSetLocation).toHaveBeenCalledWith("/my-dogs");

    // Test Profile navigation
    const profileButton = screen.getByText("Profile");
    await user.click(profileButton);
    expect(mockSetLocation).toHaveBeenCalledWith("/profile");
  });
});

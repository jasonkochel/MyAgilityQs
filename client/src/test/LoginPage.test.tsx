import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../contexts/AuthContext";
import { LoginPage } from "../pages/LoginPage";

// Mock the API
vi.mock("../lib/api", () => ({
  authApi: {
    login: vi.fn(),
  },
  tokenManager: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    getRefreshToken: vi.fn(),
    removeToken: vi.fn(),
    setTokens: vi.fn(),
    isTokenExpired: vi.fn(),
    clearOnVisibilityChange: vi.fn(),
  },
}));

// Mock Wouter
vi.mock("wouter", () => ({
  useLocation: () => ["/login", vi.fn()],
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
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
        <MantineProvider>
          <Notifications />
          <AuthProvider>{children}</AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    );
  };
};

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renders login form", () => {
    const TestWrapper = createTestWrapper();

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    expect(screen.getByText("MyAgilityQs")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("validates password length", async () => {
    const TestWrapper = createTestWrapper();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Enter valid email but short password
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "123");
    await user.click(submitButton);

    // Should show password validation error
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });
});

// __tests__/AgencyDetails.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import AgencyDetails from "../../../../components/forms/agency-details"; // Adjust the path as necessary
import "@testing-library/jest-dom"; // For better assertions

// Mocking dependencies and hooks
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}));

jest.mock("../../../../components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock implementations for async functions (can be adjusted later for specific tests)
jest.mock("@/lib/queries", () => ({
  deleteAgency: jest.fn(),
  initUser: jest.fn(),
  saveActivityLogsNotification: jest.fn(),
  updateAgencyDetails: jest.fn(),
  upsertAgency: jest.fn(),
}));

//basic test
describe("AgencyDetails Component", () => {
  it("renders without crashing", () => {
    // Arrange: Render the component with minimal props
    render(<AgencyDetails data={{ name: "Test Agency" }} />);

    // Act: Query for a heading role with text "Agency Information"
    const titleElement = screen.getByRole("heading", { name: /Agency Information/i });

    // Assert: Verify the element is in the document
    expect(titleElement).toBeInTheDocument();
  });
});

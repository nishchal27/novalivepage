// src/tests/unit/components/forms/agency-details.test.tsx
import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Agency } from "@prisma/client";
import AgencyDetails from "@/components/forms/agency-details";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

global.ResizeObserver = require("resize-observer-polyfill");

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    pathname: "/",
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  }),
}));

jest.mock('@/lib/queries');

// it('renders without errors', () => {
//   expect(() => render(<AgencyDetails />)).not.toThrow();
// });

describe('AgencyDetails', () => {
  it('handleSubmit should call upsertAgency with correct data', async () => {
    const upsertAgency = jest.fn();
    const data = {
      id: '123',
      name: 'Test Agency',
      companyEmail: 'test@example.com',
      companyPhone: '123-456-7890',
      whiteLabel: true,
      address: '123 Main St',
      city: 'Anytown',
      zipCode: '12345',
      state: 'CA',
      country: 'USA',
      agencyLogo: 'https://utfs.io/f/a371405e-4bc0-4149-890d-48bf6f23320b-awu4d2.png',
    };

    const { container } = render(
      <AgencyDetails data={data} />
    );

    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();

    if (form) {
      fireEvent.submit(form);
    } else {
      throw new Error('Form element not found');
    }

    await waitFor(() => {
      expect(upsertAgency).toHaveBeenCalledTimes(1);
      expect(upsertAgency).toHaveBeenCalledWith({
        email: data.companyEmail,
        name: data.name,
        shipping: {
          address: {
            city: data.city,
            country: data.country,
            // ... other fields ...
          },
        },
      });
    });
  });

  it('handleSubmit should handle errors', async () => {
    const upsertAgency = jest.fn(() => {
      throw new Error('Test error');
    });

    const data = {
      id: '123',
      name: 'Test Agency',
      companyEmail: 'test@example.com',
      companyPhone: '123-456-7890',
      whiteLabel: true,
      address: '123 Main St',
      city: 'Anytown',
      zipCode: '12345',
      state: 'CA',
      country: 'USA',
      agencyLogo: 'https://utfs.io/f/a371405e-4bc0-4149-890d-48bf6f23320b-awu4d2.png',
    };

    const { container } = render(
      <AgencyDetails data={data} />
    );

    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();

    if (form) {
      fireEvent.submit(form);
    } else {
      throw new Error('Form element not found');
    }

    await waitFor(() => {
      expect(upsertAgency).toHaveBeenCalledTimes(1);
      expect(container.querySelector('.error-message')).toBeInTheDocument();
    });
  });
});
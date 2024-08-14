import { render, screen } from '@testing-library/react';
import { useModal } from '@/providers/modal-provider';
import CustomModal from '../../../components/global/custom-modal'; // Adjust the path as necessary

// Mock the useModal hook
jest.mock('@/providers/modal-provider', () => ({
  useModal: jest.fn(),
}));

describe('CustomModal Component', () => {
  it('renders the modal with the correct title, subheading, and children', () => {
    // Mock the return value of useModal
    (useModal as jest.Mock).mockReturnValue({
      isOpen: true,
      setClose: jest.fn(),
    });

    // Render the CustomModal component
    render(
      <CustomModal title="Test Title" subheading="Test Subheading">
        <p>Test Child Content</p>
      </CustomModal>
    );

    // Assertions
    expect(screen.getByText(/Test Title/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Subheading/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Child Content/i)).toBeInTheDocument();
  });
});
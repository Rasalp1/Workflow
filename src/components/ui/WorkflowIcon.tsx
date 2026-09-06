import React from 'react';

export interface WorkflowIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

export const WorkflowIcon: React.FC<WorkflowIconProps> = ({
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    {...props}
  >
    <path d="M0 0h24v24H0z" fill="none" />
    <g fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2Zm10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2Zm-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2Z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 11c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1"
      />
    </g>
  </svg>
);

export default WorkflowIcon;

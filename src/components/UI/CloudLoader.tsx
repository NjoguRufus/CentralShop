import React from 'react';
import styled from 'styled-components';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const Loader = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <StyledWrapper>
      <div className="loader">
        <div className="box">
          <div className="logo">
            {isDark ? (
              <Moon className="icon" />
            ) : (
              <Sun className="icon" />
            )}
          </div>
        </div>
        <div className="box" />
        <div className="box" />
        <div className="box" />
        <div className="box" />
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .loader {
    --size: 40px;
    --duration: 2s;
    --logo-color: #22c55e;
    --background: linear-gradient(
      0deg,
      rgba(34, 197, 94, 0.2) 0%,
      rgba(74, 222, 128, 0.2) 100%
    );

    height: var(--size);
    aspect-ratio: 1;
    position: relative;
  }

  .loader .box {
    position: absolute;
    background: rgba(34, 197, 94, 0.15);
    background: var(--background);
    border-radius: 50%;
    border-top: 1px solid rgba(34, 197, 94, 1);
    backdrop-filter: blur(5px);
    animation: ripple var(--duration) infinite ease-in-out;
  }

  .loader .box:nth-child(1) {
    inset: 40%;
    z-index: 99;
  }

  .loader .box:nth-child(2) {
    inset: 30%;
    z-index: 98;
    border-color: rgba(34, 197, 94, 0.8);
    animation-delay: 0.2s;
  }

  .loader .box:nth-child(3) {
    inset: 20%;
    z-index: 97;
    border-color: rgba(34, 197, 94, 0.6);
    animation-delay: 0.4s;
  }

  .loader .box:nth-child(4) {
    inset: 10%;
    z-index: 96;
    border-color: rgba(34, 197, 94, 0.4);
    animation-delay: 0.6s;
  }

  .loader .box:nth-child(5) {
    inset: 0%;
    z-index: 95;
    border-color: rgba(34, 197, 94, 0.2);
    animation-delay: 0.8s;
  }

  .loader .logo {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    padding: 30%;
  }

  .loader .logo .icon {
    color: var(--logo-color);
    width: 60%;
    height: 60%;
    margin: auto;
    animation: color-change var(--duration) infinite ease-in-out;
  }

  @keyframes ripple {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.3);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes color-change {
    0% {
      color: var(--logo-color);
    }
    50% {
      color: #16a34a;
    }
    100% {
      color: var(--logo-color);
    }
  }
`;

export default Loader;

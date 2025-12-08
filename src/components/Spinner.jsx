import React from 'react';

const Spinner = ({ size = 32, color = '#166534', thickness = 4 }) => {
  return (
    <div
      aria-label="Carregando"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid rgba(22, 101, 52, 0.15)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
};

export default Spinner;

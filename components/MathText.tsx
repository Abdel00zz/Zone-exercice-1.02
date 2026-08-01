import React from 'react';
import { MathJax } from 'better-react-mathjax';

interface MathTextProps {
  text: string;
}

const MathText: React.FC<MathTextProps> = ({ text }) => {
  return (
    <MathJax inline dynamic>
      {/* Wrapping the text in a span helps with dynamic content updates */}
      <span>{text}</span>
    </MathJax>
  );
};

export default MathText;
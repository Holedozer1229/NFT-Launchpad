import React from 'react';
import './AnimatedCard.css';

const AnimatedCard = ({ title, content }) => {
    return (
        <div className="animated-card">
            <h2>{title}</h2>
            <p>{content}</p>
        </div>
    );
};

export default AnimatedCard;

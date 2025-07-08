import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <i className="fas fa-blog me-2"></i>
          My Blog App
        </Link>
        <div className="navbar-nav ms-auto">
          <Link className="nav-link" to="/">All Blogs</Link>
          <Link className="nav-link" to="/create">Create Blog</Link>
        </div>
      </div>
    </nav>
  );
};
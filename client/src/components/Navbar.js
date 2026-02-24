import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className='app-header'>
      <div className='app-brand'>
        <img
          src='/blogify_favicon_transparent.png'
          alt='Blogify logo'
          className='app-brand-logo'
        />
        <Link className='navbar-brand-link' to='/' style={{ textDecoration: 'none', color: 'inherit' }}>
          Blogify
        </Link>
      </div>
      <div className='header-actions'>
        <Link className='ui-button ui-button-outline ui-button-md' to='/'>
          All Blogs
        </Link>
        <Link className='ui-button ui-button-default ui-button-md' to='/create'>
          Create Blog
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

import React from 'react'
import ReactDOM from 'react-dom'
import { IDKitWidget } from '@worldcoin/idkit'

// Expose to global scope for use in index.html
window.React = React
window.ReactDOM = ReactDOM
window.IDKit = { IDKitWidget }

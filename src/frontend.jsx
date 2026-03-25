import React from 'react'
import ReactDOM from 'react-dom/client'
import { IDKitWidget, useIDKit } from '@worldcoin/idkit'

// Expose to global scope for use in index.html
window.React = React
window.ReactDOM = ReactDOM
window.IDKit = { IDKitWidget, useIDKit }

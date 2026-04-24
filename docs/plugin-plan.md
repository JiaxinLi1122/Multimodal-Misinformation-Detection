# Multi-False Browser Extension Plan

## Goal

Build a Chrome browser extension that helps users detect potentially false or misleading information on webpages.

## Minimum Demo

The first version will:

1. Read the visible text from the current webpage.
2. Send the text to the Multi-False detection backend.
3. Display a risk result in the extension popup.
4. Show a simple explanation to the user.

## Not Included in First Version

- Monitoring all apps
- Reading private chat apps
- Automatically scanning every website
- Full mobile app support

## Target Platform

Chrome / Edge browser extension.

## Basic Flow

User opens webpage  
→ clicks extension  
→ extension extracts page text  
→ sends text to backend API  
→ backend runs Multi-False model  
→ extension displays result
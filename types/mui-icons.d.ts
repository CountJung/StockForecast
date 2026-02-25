declare module '@mui/icons-material' {
  import { SvgIconProps } from '@mui/material/SvgIcon'

  export const DarkMode: React.FC<SvgIconProps>
  export const LightMode: React.FC<SvgIconProps>
}

declare module '@mui/icons-material/DarkMode' {
  import { SvgIconProps } from '@mui/material/SvgIcon'
  const DarkMode: React.FC<SvgIconProps>
  export default DarkMode
}

declare module '@mui/icons-material/LightMode' {
  import { SvgIconProps } from '@mui/material/SvgIcon'
  const LightMode: React.FC<SvgIconProps>
  export default LightMode
}

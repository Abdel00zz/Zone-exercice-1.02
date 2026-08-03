import re

with open("components/canvas/Toolbar.tsx", "r") as f:
    content = f.read()

with open("/tmp/pen_menu.tsx", "r") as f:
    replacement = f.read()

# Find the block starting with {openMenu === 'pen' && (
# and ending at the matching )}
start_idx = content.find("{openMenu === 'pen' && (")
if start_idx != -1:
    # Find the matching closing parenthesis + brace
    # It ends with:
    #             </div>
    #           )}
    #         </div>
    # 
    #         {/* Highlighter Tool */}
    end_idx = content.find("{/* Highlighter Tool */}")
    
    # We want to replace everything from start_idx up to the closing tags before {/* Highlighter Tool */}
    # Let's find the `)}` right before Highlighter Tool
    end_replace_idx = content.rfind(")}", start_idx, end_idx)
    
    # We replace content[start_idx : end_replace_idx + 2] with replacement
    new_content = content[:start_idx] + replacement + content[end_replace_idx + 2:]
    
    with open("components/canvas/Toolbar.tsx", "w") as f:
        f.write(new_content)
    print("Replaced successfully")
else:
    print("Could not find start index")
